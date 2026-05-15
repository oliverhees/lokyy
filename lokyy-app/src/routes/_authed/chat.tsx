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
import { PromptLoader } from '@/components/ui/custom/prompt/loader'
import { Suggestion } from '@/components/ui/custom/prompt/suggestion'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ArtifactPanel, extractArtifacts, type Artifact } from '@/components/chat/artifact-panel'
import { chatCompletion, type ChatMessage } from '@/lib/hermes-gateway'
import { readSettings } from '@/lib/lokyy-settings'
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
  const cleaned = content.replace(/```[\s\S]*?```/g, ' [Artefakt] ')
  const u = new SpeechSynthesisUtterance(cleaned)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    readSettings().then((s) => setTtsEnabled(s.ttsEnabled)).catch(() => {})
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

  async function submit() {
    if (!prompt.trim() || busy) return
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

    try {
      const messages: ChatMessage[] = (updated?.messages ?? []).map((m) => ({ role: m.role, content: m.content }))
      const completion = await chatCompletion({ messages })
      const reply = completion.choices[0]?.message
      if (reply) {
        const c2 = await appendMessage(conv.id, { role: 'assistant', content: reply.content, at: new Date().toISOString() })
        setActiveConv(c2)
        await refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const artifacts = useMemo(() => {
    if (!activeConv) return [] as Artifact[]
    const all: Artifact[] = []
    for (const m of activeConv.messages) {
      if (m.role !== 'assistant') continue
      all.push(...extractArtifacts(m.content))
    }
    return all
  }, [activeConv])

  const messages = activeConv?.messages ?? []
  const hasMessages = messages.length > 0

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-md border bg-card" data-testid="chat-page">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={removeConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h1 className="truncate text-sm font-medium" data-testid="chat-title">
            {activeConv?.title ?? 'Neuer Chat'}
          </h1>
          {artifacts.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveArtifact(artifacts[artifacts.length - 1])}
              data-testid="chat-show-artifacts"
            >
              <FileCodeIcon className="size-3.5" />
              {artifacts.length} Artefakt{artifacts.length === 1 ? '' : 'e'}
            </Button>
          ) : null}
        </div>

        <ChatContainer className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-6">
            {!hasMessages ? (
              <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-inner">
                  L
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Wie kann Lokyy dir heute helfen?</h2>
                  <p className="text-sm text-muted-foreground">Frag mich alles oder wähle einen Vorschlag.</p>
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
                const msgArtifacts = !isUser ? extractArtifacts(m.content) : []
                return (
                  <Message
                    key={i}
                    className={isUser ? 'justify-end' : 'justify-start'}
                    data-testid={`chat-${m.role}`}
                  >
                    <div className="max-w-[80%] space-y-2">
                      <MessageContent
                        markdown={!isUser}
                        className={
                          isUser
                            ? 'rounded-2xl bg-primary px-4 py-2 text-primary-foreground'
                            : 'bg-transparent p-0 text-foreground'
                        }
                      >
                        {m.content}
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
                          {ttsEnabled ? (
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
            {busy ? <Message className="justify-start"><PromptLoader variant="dots" /></Message> : null}
          </div>
        </ChatContainer>

        {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}

        <div className="border-t p-4">
          <PromptInput value={prompt} onValueChange={setPrompt} onSubmit={submit} isLoading={busy}>
            <PromptInputTextarea placeholder="Frag Lokyy…" disabled={busy} data-testid="chat-input" />
            <PromptInputActions className="justify-end pt-2">
              <PromptInputAction tooltip="Datei (kommt)"><Button variant="ghost" size="icon" className="size-9" disabled><Paperclip className="size-4" /></Button></PromptInputAction>
              <PromptInputAction tooltip="Web-Suche (kommt)"><Button variant="ghost" size="icon" className="size-9" disabled><GlobeIcon className="size-4" /></Button></PromptInputAction>
              <PromptInputAction tooltip="Deep Think (kommt)"><Button variant="ghost" size="icon" className="size-9" disabled><BrainIcon className="size-4" /></Button></PromptInputAction>
              {busy ? (
                <PromptInputAction tooltip="Stop"><Button variant="ghost" size="icon" className="size-9" onClick={() => setBusy(false)}><SquareIcon className="size-4" /></Button></PromptInputAction>
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
