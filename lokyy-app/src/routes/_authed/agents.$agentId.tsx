import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeftIcon, BrainCircuitIcon, KeyIcon, ZapIcon, SendIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listAgents, gradientForAgent, initialsFor, type Agent } from '@/lib/lokyy-agents'
import { chatCompletion, type ChatMessage } from '@/lib/hermes-gateway'

export const Route = createFileRoute('/_authed/agents/$agentId')({
  loader: async ({ params }) => {
    const agents = await listAgents()
    const agent = agents.find((a) => a.id === params.agentId)
    if (!agent) throw redirect({ to: '/agents' })
    return { agent }
  },
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const { agent } = Route.useLoaderData()
  return (
    <div className="space-y-4">
      <DetailHeader agent={agent} />
      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="skills">Skills ({agent.skillCount})</TabsTrigger>
          <TabsTrigger value="mcp">MCP ({agent.mcpCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4">
          <ChatTab agent={agent} />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <ComingSoonCard
            title="Skills"
            description="Die Liste aller installierten Skills für diesen Agent mit Toggle pro Skill — kommt in Phase 1.3."
          />
        </TabsContent>
        <TabsContent value="mcp" className="mt-4">
          <ComingSoonCard
            title="MCP-Server"
            description="Die MCP-Server-Konfiguration pro Agent — kommt in Phase 1.4."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DetailHeader({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" data-testid="back-to-agents">
          <Link to="/agents">
            <ArrowLeftIcon className="size-5" />
          </Link>
        </Button>
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-inner ring-4 ring-background"
          style={{ background: gradientForAgent(agent.id) }}
          aria-hidden
        >
          {initialsFor(agent.name)}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{agent.name}</h1>
            {agent.isDefault ? <Badge variant="secondary">Default</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">{agent.model} · {agent.provider}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Skills">
          <ZapIcon className="size-3.5" /> {agent.skillCount}
        </span>
        <span className="flex items-center gap-1" title="MCP-Server">
          <KeyIcon className="size-3.5" /> {agent.mcpCount}
        </span>
        {agent.hasSoul ? (
          <span className="flex items-center gap-1" title="Hat SOUL.md">
            <BrainCircuitIcon className="size-3.5" /> SOUL
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ChatTab({ agent: _agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

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
    <Card className="flex h-[calc(100vh-22rem)] flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        data-testid="agent-chat-messages"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Schick eine Nachricht, um mit dem Agent zu sprechen.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              data-testid={`agent-chat-${m.role}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-card text-card-foreground'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>
      {error ? (
        <p className="px-4 pb-2 text-sm text-destructive" role="alert" data-testid="agent-chat-error">
          {error}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t p-3">
        <Input
          placeholder="Nachricht an den Agent…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          data-testid="agent-chat-input"
        />
        <Button type="submit" disabled={busy || !input.trim()} data-testid="agent-chat-send">
          <SendIcon className="size-4" />
          {busy ? 'Sende…' : 'Senden'}
        </Button>
      </form>
    </Card>
  )
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
