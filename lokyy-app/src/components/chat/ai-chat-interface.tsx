import { useEffect, useRef, useState } from 'react'
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
import { Markdown } from '@/components/ui/custom/prompt/markdown'
import { PromptLoader } from '@/components/ui/custom/prompt/loader'
import { Suggestion } from '@/components/ui/custom/prompt/suggestion'
import { gradientForAgent, initialsFor, type Agent } from '@/lib/lokyy-agents'
import { chatCompletion, type ChatMessage } from '@/lib/hermes-gateway'
import { readSettings } from '@/lib/lokyy-settings'

const SUGGESTIONS = [
  'Was kannst du heute für mich tun?',
  'Fasse mir die letzten Sessions zusammen',
  'Gib mir eine Code-Review-Checkliste',
  'Plane meinen Tag in 5 Bullets',
]

function speakMessage(content: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const cleaned = content.replace(/```[\s\S]*?```/g, ' [code block] ')
  const u = new SpeechSynthesisUtterance(cleaned)
  u.lang = 'de-DE'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export function AIChatInterface({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    readSettings()
      .then((s) => setTtsEnabled(s.ttsEnabled))
      .catch(() => {})
  }, [])

  async function submit() {
    if (!prompt.trim() || busy) return
    setError(null)
    const userMsg: ChatMessage = { role: 'user', content: prompt.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setPrompt('')
    setBusy(true)
    try {
      const completion = await chatCompletion({ messages: next })
      const reply = completion.choices[0]?.message
      if (reply) setMessages([...next, reply])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    setBusy(false)
  }

  const hasConversation = messages.length > 0

  return (
    <div className="flex h-full flex-col" data-testid="ai-chat-interface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div
          className="flex size-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: gradientForAgent(agent.id) }}
          aria-hidden
        >
          {initialsFor(agent.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{agent.name}</p>
          <p className="truncate text-xs text-muted-foreground">{agent.model}</p>
        </div>
      </div>

      {/* Conversation */}
      <ChatContainer className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-4 py-6">
          {!hasConversation ? (
            <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
              <div
                className="flex size-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-inner"
                style={{ background: gradientForAgent(agent.id) }}
                aria-hidden
              >
                {initialsFor(agent.name)}
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Wie kann {agent.name} dir heute helfen?</h2>
                <p className="text-sm text-muted-foreground">{agent.description || 'Frag mich alles.'}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <Suggestion key={s} onClick={() => setPrompt(s)}>
                    {s}
                  </Suggestion>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const isUser = m.role === 'user'
              return (
                <Message
                  key={i}
                  className={isUser ? 'justify-end' : 'justify-start'}
                  data-testid={`ai-chat-${m.role}`}
                >
                  <MessageContent
                    markdown={!isUser}
                    className={
                      isUser
                        ? 'max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground'
                        : 'max-w-[80%] bg-transparent p-0 text-foreground'
                    }
                  >
                    {m.content}
                  </MessageContent>
                  {!isUser ? (
                    <MessageActions className="-mt-1 ml-11 flex">
                      <MessageAction tooltip="Kopieren">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => navigator.clipboard.writeText(m.content)}
                        >
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
                        <Button variant="ghost" size="icon" className="size-7">
                          <ThumbsUpIcon className="size-3.5" />
                        </Button>
                      </MessageAction>
                      <MessageAction tooltip="Nicht hilfreich">
                        <Button variant="ghost" size="icon" className="size-7">
                          <ThumbsDownIcon className="size-3.5" />
                        </Button>
                      </MessageAction>
                    </MessageActions>
                  ) : null}
                </Message>
              )
            })
          )}
          {busy ? (
            <Message className="justify-start">
              <PromptLoader variant="dots" />
            </Message>
          ) : null}
        </div>
      </ChatContainer>

      {error ? (
        <p className="px-4 pb-2 text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {/* Composer */}
      <div className="border-t bg-background/40 p-4 backdrop-blur-md">
        <PromptInput
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={submit}
          isLoading={busy}
        >
          <PromptInputTextarea
            placeholder={`Schreib an ${agent.name}…`}
            disabled={busy}
            data-testid="ai-chat-input"
          />
          <PromptInputActions className="justify-end pt-2">
            <PromptInputAction tooltip="Datei anhängen (kommt)">
              <Button variant="ghost" size="icon" className="size-9" disabled>
                <Paperclip className="size-4" />
              </Button>
            </PromptInputAction>
            <PromptInputAction tooltip="Web-Suche (kommt)">
              <Button variant="ghost" size="icon" className="size-9" disabled>
                <GlobeIcon className="size-4" />
              </Button>
            </PromptInputAction>
            <PromptInputAction tooltip="Deep Think (kommt)">
              <Button variant="ghost" size="icon" className="size-9" disabled>
                <BrainIcon className="size-4" />
              </Button>
            </PromptInputAction>
            {busy ? (
              <PromptInputAction tooltip="Stop">
                <Button variant="ghost" size="icon" className="size-9" onClick={stop}>
                  <SquareIcon className="size-4" />
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Senden">
                <Button
                  size="icon"
                  className="size-9"
                  onClick={submit}
                  disabled={!prompt.trim()}
                  data-testid="ai-chat-send"
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
              </PromptInputAction>
            )}
            {hasConversation ? (
              <PromptInputAction tooltip="Neu starten">
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setMessages([])}>
                  <XIcon className="size-4" />
                </Button>
              </PromptInputAction>
            ) : null}
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}
