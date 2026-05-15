import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpIcon,
  BrainIcon,
  GlobeIcon,
  Paperclip,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2Icon,
  XIcon,
  FileCodeIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from 'lucide-react'
import { CopyIcon } from '@radix-ui/react-icons'
import {
  Input as PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/custom/prompt/input'
import { Button } from '@/components/ui/button'
import { ChatContainer } from '@/components/ui/custom/prompt/chat-container'
import { Message, MessageAction, MessageActions, MessageContent } from '@/components/ui/custom/prompt/message'
import { Suggestion } from '@/components/ui/custom/prompt/suggestion'
import { ThinkingStatus } from '@/components/chat/thinking-status'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ArtifactPanel, extractArtifacts, type Artifact } from '@/components/chat/artifact-panel'
import { AIOrb } from '@/components/chat/ai-orb'
import { UsageMeter } from '@/components/chat/usage-meter'
import { SlashCommandsPopover, type SlashCommand } from '@/components/chat/slash-commands'
import { ThinkingDisplay, extractThinking } from '@/components/chat/thinking-display'
import { streamChatCompletion, type ChatMessage } from '@/lib/hermes-gateway'
import { readSettings, patchSettings, type LokyySettings } from '@/lib/lokyy-settings'
import {
  listConversations,
  createConversation,
  getConversation,
  appendMessage,
  deleteConversation,
  type Conversation,
} from '@/lib/lokyy-conversations'

export const Route = createFileRoute('/_authed/chat')({ component: ChatPage })

const SUGGESTIONS = [
  'Was kannst du heute für mich tun?',
  'Schreib mir eine HTML-Landing-Page',
  'Gib mir ein TypeScript-Snippet für…',
  'Plane meinen Tag in 5 Bullets',
]

function speakMessage(content: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const cleaned = content
    .replace(/```[\s\S]*?```/g, ' [Artefakt] ')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  const u = new SpeechSynthesisUtterance(cleaned)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

const THINKING_PROMPT =
  'Bevor du antwortest, denke laut nach. Schreibe deinen Gedankengang in <thinking>...</thinking> Tags, danach gib die Antwort an den User.'

const LOKYY_CHAT_SYSTEM =
  'Du bist Lokyy-Chat. Wichtige Output-Regeln:\n' +
  '1. Code, HTML, JSON, SVG, Markdown immer als Markdown-fenced-code-block in deiner Antwort schreiben (```html ... ``` etc.). Lokyy rendert das automatisch als Artefakt im Side-Panel.\n' +
  '2. Verwende NIEMALS file/terminal/code_execution Tools, um Dateien auf der Festplatte zu erstellen, schreiben oder zu lesen, außer der User fragt explizit nach Filesystem-Operationen.\n' +
  '3. Antworte in derselben Sprache wie der User. Klar, knapp, freundlich.'

function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<LokyySettings | null>(null)
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [streamingText, setStreamingText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    readSettings()
      .then((s) => {
        setSettings(s)
        setSidebarOpen(!s.chatSidebarCollapsed)
      })
      .catch(() => {})
    refresh()
  }, [])

  async function refresh() {
    const list = await listConversations()
    setConversations(list)
  }

  async function selectConversation(id: string) {
    setActiveId(id)
    setActiveArtifact(null)
    const c = await getConversation(id)
    setActiveConv(c)
  }

  async function newConversation() {
    const c = await createConversation({})
    setConversations((prev) => [c, ...prev])
    setActiveId(c.id)
    setActiveConv(c)
    setActiveArtifact(null)
  }

  async function removeConversation(id: string) {
    await deleteConversation(id)
    if (activeId === id) {
      setActiveId(null)
      setActiveConv(null)
    }
    await refresh()
  }

  function toggleSidebar() {
    const next = !sidebarOpen
    setSidebarOpen(next)
    if (settings) {
      patchSettings({ chatSidebarCollapsed: !next }).catch(() => {})
    }
  }

  async function toggleThinking() {
    if (!settings) return
    const s = await patchSettings({ thinkingEnabled: !settings.thinkingEnabled })
    setSettings(s)
  }

  const slashCommands: SlashCommand[] = [
    {
      trigger: 'clear',
      label: 'Neuer Chat',
      description: 'Aktuelle Konversation schließen und neu starten',
      handler: () => {
        setPrompt('')
        newConversation()
      },
    },
    {
      trigger: 'think',
      label: 'Thinking umschalten',
      description: `Extended Thinking ${settings?.thinkingEnabled ? 'AUS' : 'AN'}`,
      handler: () => {
        setPrompt('')
        toggleThinking()
      },
    },
    {
      trigger: 'tts',
      label: 'TTS umschalten',
      description: `Text-to-Speech ${settings?.ttsEnabled ? 'AUS' : 'AN'}`,
      handler: async () => {
        setPrompt('')
        if (!settings) return
        const s = await patchSettings({ ttsEnabled: !settings.ttsEnabled })
        setSettings(s)
      },
    },
    {
      trigger: 'artifacts',
      label: 'Auto-Open Artefakte',
      description: `Side-Panel ${settings?.autoOpenArtifacts ? 'NICHT' : 'automatisch'} öffnen`,
      handler: async () => {
        setPrompt('')
        if (!settings) return
        const s = await patchSettings({ autoOpenArtifacts: !settings.autoOpenArtifacts })
        setSettings(s)
      },
    },
  ]

  async function submit() {
    if (!prompt.trim() || busy) return
    if (prompt.startsWith('/')) {
      const cmd = slashCommands.find((c) => c.trigger === prompt.slice(1).trim())
      if (cmd) {
        cmd.handler('')
        return
      }
    }
    let conv = activeConv
    if (!conv) {
      conv = await createConversation({})
      setActiveId(conv.id)
      setActiveConv(conv)
      setConversations((prev) => [conv!, ...prev])
    }
    setError(null)
    const userMsg = { role: 'user' as const, content: prompt.trim(), at: new Date().toISOString() }
    const updated = await appendMessage(conv.id, userMsg)
    setActiveConv(updated)
    setPrompt('')
    setBusy(true)

    const baseMessages: ChatMessage[] = (updated?.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }))
    const systemMessages: ChatMessage[] = []
    systemMessages.push({ role: 'system', content: LOKYY_CHAT_SYSTEM })
    if (settings?.thinkingEnabled) systemMessages.push({ role: 'system', content: THINKING_PROMPT })
    const messages = [...systemMessages, ...baseMessages]

    setStreamingText('')
    const ctrl = new AbortController()
    abortRef.current = ctrl

    await streamChatCompletion(
      { messages },
      {
        signal: ctrl.signal,
        onChunk: (delta) => setStreamingText((prev) => prev + delta),
        onError: (err) => {
          setError(err.message)
          setBusy(false)
          abortRef.current = null
        },
        onDone: async (full) => {
          setStreamingText('')
          if (full.trim()) {
            const c2 = await appendMessage(conv.id, {
              role: 'assistant',
              content: full,
              at: new Date().toISOString(),
            })
            setActiveConv(c2)
            await refresh()
            if (settings?.autoOpenArtifacts) {
              const { cleanContent } = extractThinking(full)
              const arts = extractArtifacts(cleanContent)
              if (arts.length > 0) setActiveArtifact(arts[arts.length - 1])
            }
          }
          setBusy(false)
          abortRef.current = null
        },
      },
    )
  }

  const artifacts = useMemo(() => {
    if (!activeConv) return [] as Artifact[]
    const all: Artifact[] = []
    for (const m of activeConv.messages) {
      if (m.role !== 'assistant') continue
      const { cleanContent } = extractThinking(m.content)
      all.push(...extractArtifacts(cleanContent))
    }
    return all
  }, [activeConv])

  const messages = activeConv?.messages ?? []
  const hasMessages = messages.length > 0
  const showSlash = prompt.startsWith('/')

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-md border bg-card" data-testid="chat-page">
      {sidebarOpen ? (
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={removeConversation}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggleSidebar}
              data-testid="chat-toggle-sidebar"
              title={sidebarOpen ? 'History einklappen' : 'History ausklappen'}
            >
              {sidebarOpen ? <PanelLeftCloseIcon className="size-4" /> : <PanelLeftOpenIcon className="size-4" />}
            </Button>
            <h1 className="truncate text-sm font-medium" data-testid="chat-title">
              {activeConv?.title ?? 'Neuer Chat'}
            </h1>
            {settings?.thinkingEnabled ? (
              <span
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                data-testid="thinking-indicator"
              >
                Thinking AN
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <UsageMeter model={activeConv?.model ?? 'hermes-agent'} messages={messages} />
            {artifacts.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveArtifact(artifacts[artifacts.length - 1])}
                data-testid="chat-show-artifacts"
              >
                <FileCodeIcon className="size-3.5" />
                {artifacts.length}
              </Button>
            ) : null}
          </div>
        </div>

        <ChatContainer className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-6">
            {!hasMessages ? (
              <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
                <AIOrb size={160} />
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Wie kann Lokyy dir heute helfen?</h2>
                  <p className="text-sm text-muted-foreground">
                    Tipp <code className="rounded bg-muted px-1">/</code> für Commands oder wähle einen Vorschlag.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Suggestion key={s} onClick={() => setPrompt(s)}>{s}</Suggestion>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                const isUser = m.role === 'user'
                const { thinking, cleanContent } = isUser
                  ? { thinking: null, cleanContent: m.content }
                  : extractThinking(m.content)
                const msgArtifacts = !isUser ? extractArtifacts(cleanContent) : []
                return (
                  <Message
                    key={i}
                    className={isUser ? 'justify-end' : 'justify-start'}
                    data-testid={`chat-${m.role}`}
                  >
                    <div className="max-w-[80%] space-y-2">
                      {thinking ? <ThinkingDisplay thinking={thinking} /> : null}
                      <MessageContent
                        markdown={!isUser}
                        className={
                          isUser
                            ? 'rounded-2xl bg-primary px-4 py-2 text-primary-foreground'
                            : 'bg-transparent p-0 text-foreground'
                        }
                      >
                        {cleanContent}
                      </MessageContent>
                      {msgArtifacts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {msgArtifacts.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => setActiveArtifact(a)}
                              className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted"
                              data-testid="chat-artifact-pill"
                            >
                              <FileCodeIcon className="size-3.5" />
                              <span className="font-mono">{a.language}</span>
                              <span className="text-muted-foreground">{a.code.split('\n').length} Zeilen</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {!isUser ? (
                        <MessageActions>
                          <MessageAction tooltip="Kopieren">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => navigator.clipboard.writeText(m.content)}>
                              <CopyIcon className="size-3.5" />
                            </Button>
                          </MessageAction>
                          {settings?.ttsEnabled ? (
                            <MessageAction tooltip="Vorlesen">
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => speakMessage(m.content)}>
                                <Volume2Icon className="size-3.5" />
                              </Button>
                            </MessageAction>
                          ) : null}
                          <MessageAction tooltip="Hilfreich">
                            <Button variant="ghost" size="icon" className="size-7"><ThumbsUpIcon className="size-3.5" /></Button>
                          </MessageAction>
                          <MessageAction tooltip="Nicht hilfreich">
                            <Button variant="ghost" size="icon" className="size-7"><ThumbsDownIcon className="size-3.5" /></Button>
                          </MessageAction>
                        </MessageActions>
                      ) : null}
                    </div>
                  </Message>
                )
              })
            )}
            {busy ? (
              <Message className="justify-start">
                <div className="flex max-w-[80%] flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <AIOrb size={28} />
                    <ThinkingStatus />
                  </div>
                  {streamingText ? (
                    <div className="whitespace-pre-wrap text-sm" data-testid="streaming-text">
                      {extractThinking(streamingText).cleanContent}
                      <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
                    </div>
                  ) : null}
                </div>
              </Message>
            ) : null}
          </div>
        </ChatContainer>

        {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}

        <div className="relative border-t p-4">
          {showSlash ? (
            <SlashCommandsPopover
              query={prompt}
              commands={slashCommands}
              onSelect={(c) => c.handler('')}
            />
          ) : null}
          <PromptInput value={prompt} onValueChange={setPrompt} onSubmit={submit} isLoading={busy}>
            <PromptInputTextarea
              placeholder="Frag Lokyy… (tipp / für Commands)"
              disabled={busy}
              data-testid="chat-input"
            />
            <PromptInputActions className="justify-end pt-2">
              <PromptInputAction tooltip="Datei (kommt)"><Button variant="ghost" size="icon" className="size-9" disabled><Paperclip className="size-4" /></Button></PromptInputAction>
              <PromptInputAction tooltip="Web-Suche (kommt)"><Button variant="ghost" size="icon" className="size-9" disabled><GlobeIcon className="size-4" /></Button></PromptInputAction>
              <PromptInputAction tooltip={settings?.thinkingEnabled ? 'Thinking AUS' : 'Thinking AN'}>
                <Button
                  variant={settings?.thinkingEnabled ? 'default' : 'ghost'}
                  size="icon"
                  className="size-9"
                  onClick={toggleThinking}
                  data-testid="chat-thinking-toggle"
                >
                  <BrainIcon className="size-4" />
                </Button>
              </PromptInputAction>
              {busy ? (
                <PromptInputAction tooltip="Stop">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() => {
                      abortRef.current?.abort()
                      setBusy(false)
                    }}
                  >
                    <SquareIcon className="size-4" />
                  </Button>
                </PromptInputAction>
              ) : (
                <PromptInputAction tooltip="Senden"><Button size="icon" className="size-9" onClick={submit} disabled={!prompt.trim()} data-testid="chat-send"><ArrowUpIcon className="size-4" /></Button></PromptInputAction>
              )}
              {hasMessages ? (
                <PromptInputAction tooltip="Neu starten"><Button variant="ghost" size="icon" className="size-9" onClick={newConversation}><XIcon className="size-4" /></Button></PromptInputAction>
              ) : null}
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>

      <ArtifactPanel artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
    </div>
  )
}
