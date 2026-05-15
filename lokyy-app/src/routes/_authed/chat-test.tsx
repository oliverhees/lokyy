import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { chatCompletion, health, type ChatMessage } from '@/lib/hermes-gateway'

export const Route = createFileRoute('/_authed/chat-test')({
  component: ChatTestPage,
})

type ConnState = 'checking' | 'up' | 'down'

function ChatTestPage() {
  const [conn, setConn] = useState<ConnState>('checking')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    health()
      .then(() => setConn('up'))
      .catch(() => setConn('down'))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || busy) return
    setError(null)
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const completion = await chatCompletion({ messages: next })
      const reply = completion.choices[0]?.message
      if (reply) setMessages([...next, reply])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Chat-Test</h1>
        <Badge
          variant={conn === 'up' ? 'default' : conn === 'down' ? 'destructive' : 'secondary'}
          data-testid="gateway-status"
        >
          Hermes-Gateway: {conn === 'up' ? 'verbunden' : conn === 'down' ? 'offline' : 'prüfe…'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hello-World gegen Hermes</CardTitle>
          <CardDescription>
            Diese Seite ist Phase-0.4-Wiring — sie zeigt, dass Lokyy-Frontend gegen{' '}
            <code className="rounded bg-muted px-1">localhost:8642</code> spricht (über Vite-Proxy{' '}
            <code className="rounded bg-muted px-1">/api/hermes</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="min-h-64 space-y-3 rounded-md border bg-muted/30 p-4"
            data-testid="message-list"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Schick eine Nachricht, um die Anbindung zu testen.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${m.role}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground border'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert" data-testid="chat-error">
              {error}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              placeholder="Frage Hermes etwas…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || conn === 'down'}
              data-testid="chat-input"
            />
            <Button
              type="submit"
              disabled={busy || conn !== 'up' || !input.trim()}
              data-testid="chat-send"
            >
              {busy ? 'Sende…' : 'Senden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
