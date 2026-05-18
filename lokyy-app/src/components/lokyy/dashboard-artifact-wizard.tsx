import { useEffect, useMemo, useRef, useState } from 'react'
import { SparklesIcon, SendIcon, SaveIcon, RotateCcwIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { draftChat, createFromDraft, type ChatTurn, type Draft, type DraftSpec } from '@/lib/lokyy-dashboards'

const DEMO_DATA: Record<string, unknown> = {
  'ki-news': {
    runAt: new Date().toISOString(),
    items: [
      {
        title: 'Anthropic publishes new agentic skills guide',
        summary: '432 points · 187 comments',
        source: 'Hacker News',
        url: 'https://news.ycombinator.com/',
      },
      {
        title: 'OpenAI shifts compute strategy for Q3 inference workloads',
        summary: '224 points · 91 comments',
        source: 'Hacker News',
        url: 'https://news.ycombinator.com/',
      },
      {
        title: 'DeepSeek-V4 reasoning benchmarks leak ahead of launch',
        summary: '188 points · 76 comments',
        source: 'Hacker News',
        url: 'https://news.ycombinator.com/',
      },
    ],
  },
  'email-digest': {
    runAt: new Date().toISOString(),
    groups: [
      {
        name: 'Newsletter',
        mails: [
          {
            subject: 'Wochen-Update: KI im Mittelstand',
            snippet: 'Drei Trends aus dieser Woche…',
            actionable: false,
          },
        ],
      },
      {
        name: 'Action items',
        mails: [
          {
            subject: 'Rechnungsfreigabe bis Freitag',
            snippet: 'Acme Corp benötigt deine Bestätigung',
            actionable: true,
          },
        ],
      },
    ],
  },
}

export function DashboardArtifactWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [chatInput, setChatInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [readyToSave, setReadyToSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMessages([])
      setChatInput('')
      setBusy(false)
      setDraft(null)
      setReadyToSave(false)
      setSaving(false)
      setError(null)
    }
  }, [open])

  // Blob URL for the current draft HTML
  const blobUrl = useMemo(() => {
    if (!draft?.view_html) return null
    const blob = new Blob([draft.view_html], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [draft?.view_html])

  // Revoke old blob URL on change
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  // Push demo data into the iframe so the user sees the layout populated
  useEffect(() => {
    if (!draft || !iframeRef.current) return
    const win = iframeRef.current.contentWindow
    if (!win) return
    const sendData = () => {
      win.postMessage(
        { type: 'lokyy:dashboard:data', payload: DEMO_DATA[draft.spec.template] },
        '*',
      )
    }
    // Listen for ready signal from the iframe (then push)
    function onMsg(ev: MessageEvent) {
      if (ev.source !== win) return
      if (ev.data?.type === 'lokyy:dashboard:ready') sendData()
    }
    window.addEventListener('message', onMsg)
    // Also push immediately in case the iframe was already ready before this effect attached
    setTimeout(sendData, 250)
    return () => window.removeEventListener('message', onMsg)
  }, [blobUrl, draft])

  function scrollChatToEnd() {
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }, 50)
  }

  async function sendTurn() {
    const text = chatInput.trim()
    if (!text || busy) return
    const next: ChatTurn[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setChatInput('')
    setBusy(true)
    setError(null)
    try {
      const res = await draftChat(next, draft ?? undefined)
      const assistantContent = res.message
      setMessages([...next, { role: 'assistant', content: assistantContent }])
      if (res.kind === 'draft' || res.kind === 'final') {
        setDraft({ spec: res.spec, view_html: res.view_html })
        setReadyToSave(res.kind === 'final')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      scrollChatToEnd()
    }
  }

  async function save() {
    if (!draft || saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await createFromDraft(draft.spec, draft.view_html)
      onCreated(result.dashboardId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-5xl"
        data-testid="dashboard-artifact-wizard"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            Dashboard-Wizard
          </DialogTitle>
          <DialogDescription>
            Chatte mit dem Agent. Er baut einen Live-Entwurf rechts. Du gibst Feedback bis es passt — dann speichern.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-4 h-[60vh]">
          {/* Chat column */}
          <div className="flex flex-col h-full border rounded-md overflow-hidden">
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20"
              data-testid="wizard-chat-messages"
            >
              {messages.length === 0 && !draft && (
                <div className="text-muted-foreground text-sm italic">
                  Beispiel: «Bau mir KI-News mit gelben Akzenten und großen Cards».
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    data-testid={`wizard-msg-${m.role}`}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-foreground border'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-card text-muted-foreground border rounded-lg px-3 py-2 text-sm">
                    Lokyy denkt nach…
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-2 flex items-center gap-2 bg-background">
              <Input
                data-testid="wizard-chat-input"
                placeholder="Was soll auf dem Dashboard zu sehen sein?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={busy || saving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendTurn()
                  }
                }}
              />
              <Button
                size="icon"
                onClick={sendTurn}
                disabled={busy || saving || chatInput.trim().length === 0}
                data-testid="wizard-chat-send"
              >
                <SendIcon className="size-4" />
              </Button>
            </div>
          </div>

          {/* Preview column */}
          <div className="flex flex-col h-full border rounded-md overflow-hidden bg-background">
            <div className="border-b px-3 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Live-Preview</span>
                {draft && (
                  <>
                    <Badge variant="outline">{draft.spec.template}</Badge>
                    <span className="font-mono text-muted-foreground">{draft.spec.schedule}</span>
                  </>
                )}
              </div>
              {draft && (
                <span className="text-muted-foreground" data-testid="wizard-spec-title">{draft.spec.title}</span>
              )}
            </div>
            {draft && blobUrl ? (
              <iframe
                ref={iframeRef}
                src={blobUrl}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                title="Dashboard preview"
                data-testid="wizard-preview-iframe"
                className="flex-1 w-full block bg-background"
                style={{ border: 0 }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                Sobald der Agent einen Entwurf baut, taucht hier die Live-Preview auf. <br />Mit Demo-Daten.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="border border-destructive/50 text-destructive rounded-md px-3 py-2 text-sm" data-testid="wizard-error">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          {draft && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null)
                setReadyToSave(false)
              }}
              disabled={saving || busy}
              data-testid="wizard-discard-draft"
            >
              <RotateCcwIcon className="size-4" />
              Neu starten
            </Button>
          )}
          <Button
            onClick={save}
            disabled={!draft || saving || busy}
            data-testid="wizard-save"
            variant={readyToSave ? 'default' : 'outline'}
          >
            <SaveIcon className="size-4" />
            {saving ? 'Speichert…' : 'Als Dashboard speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
