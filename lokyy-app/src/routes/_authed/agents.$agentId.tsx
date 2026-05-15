import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeftIcon, BrainCircuitIcon, KeyIcon, ZapIcon, SendIcon, SearchIcon, PlusIcon, ServerIcon, GlobeIcon, CopyIcon, FileCodeIcon, Volume2Icon } from 'lucide-react'
import { readSettings } from '@/lib/lokyy-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listAgents, listAgentSkills, listAgentMcps, toggleAgentSkill, toggleAgentMcp, gradientForAgent, initialsFor, type Agent, type AgentSkill, type AgentMcp, type McpPreset } from '@/lib/lokyy-agents'
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
          <SkillsTab agent={agent} />
        </TabsContent>
        <TabsContent value="mcp" className="mt-4">
          <McpTab agent={agent} />
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
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    readSettings()
      .then((s) => setTtsEnabled(s.ttsEnabled))
      .catch(() => {})
  }, [])

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
                className={`relative max-w-[80%] space-y-2 rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-card text-card-foreground'
                }`}
              >
                <MessageContent content={m.content} />
                {ttsEnabled && m.role === 'assistant' ? (
                  <button
                    type="button"
                    onClick={() => speakMessage(m.content)}
                    className="absolute -bottom-3 -right-3 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                    title="Antwort vorlesen"
                    data-testid="chat-tts"
                  >
                    <Volume2Icon className="size-3.5" />
                  </button>
                ) : null}
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

function McpTab({ agent }: { agent: Agent }) {
  const [data, setData] = useState<{ mcps: AgentMcp[]; presets: McpPreset[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAgentMcps(agent.id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [agent.id])

  async function onToggle(mcp: AgentMcp) {
    if (!data) return
    const before = data
    const optimistic = {
      ...data,
      mcps: data.mcps.map((m) =>
        m.id === mcp.id ? { ...m, status: m.status === 'enabled' ? 'disabled' as const : 'enabled' as const } : m,
      ),
    }
    setData(optimistic)
    try {
      await toggleAgentMcp(agent.id, mcp.id)
    } catch (err) {
      setData(before)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive" role="alert">{error}</p>
        </CardContent>
      </Card>
    )
  }
  if (data === null) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">lade MCP-Server…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>MCP-Server</CardTitle>
              <p className="text-xs text-muted-foreground">
                {data.mcps.length} konfiguriert · Klick auf Switch zum Umschalten · Add-Wizard kommt in Phase 2
              </p>
            </div>
            <Button
              data-testid="mcp-add"
              title="Add-Wizard kommt in Phase 1.5"
              className="cursor-not-allowed"
              onClick={(e) => e.preventDefault()}
            >
              <PlusIcon className="size-4" />
              MCP-Server hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.mcps.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="mcps-empty">
              Noch keine MCP-Server für diesen Agent konfiguriert. Wähle unten ein Preset oder leg via CLI an:{' '}
              <code className="rounded bg-muted px-1">hermes mcp add &lt;name&gt;</code>
            </p>
          ) : (
            <ul className="divide-y divide-border/60" data-testid="mcps-list">
              {data.mcps.map((mcp) => (
                <li key={mcp.id} className="flex items-center gap-4 py-3">
                  <McpTransportIcon transport={mcp.transportType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{mcp.name}</span>
                      <Badge variant="secondary" className="text-xs">{mcp.transportType}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {mcp.command ?? mcp.url ?? '—'}
                    </p>
                  </div>
                  <Switch
                    checked={mcp.status === 'enabled'}
                    onCheckedChange={() => onToggle(mcp)}
                    data-testid={`mcp-toggle-${mcp.name}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.presets.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verfügbare Presets</CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.presets.length} Vorlagen aus <code className="rounded bg-muted px-1">~/.hermes/mcp-presets.json</code>
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="mcps-presets">
              {data.presets.slice(0, 12).map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
                  data-testid={`mcp-preset-${preset.id}`}
                >
                  <div className="flex items-center gap-2">
                    <McpTransportIcon transport={preset.template.transportType} />
                    <span className="truncate font-medium">{preset.name}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preset.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

type MessagePart = { type: 'text'; text: string } | { type: 'code'; language: string; code: string }

function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = []
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text.trim()) parts.push({ type: 'text', text })
    }
    parts.push({ type: 'code', language: match[1] || 'text', code: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text.trim()) parts.push({ type: 'text', text })
  }
  if (parts.length === 0) parts.push({ type: 'text', text: content })
  return parts
}

function MessageContent({ content }: { content: string }) {
  const parts = parseMessageParts(content)
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">{p.text}</p>
        ) : (
          <CodeArtifact key={i} language={p.language} code={p.code} />
        ),
      )}
    </>
  )
}

function speakMessage(content: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const cleaned = content.replace(/```[\s\S]*?```/g, ' [code block] ')
  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.lang = 'de-DE'
  utterance.rate = 1
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

function CodeArtifact({ language, code }: { language: string; code: string }) {
  async function onCopy() {
    await navigator.clipboard.writeText(code)
  }
  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/40 text-foreground" data-testid="chat-artifact">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5 text-xs">
        <span className="flex items-center gap-1 font-mono">
          <FileCodeIcon className="size-3.5" /> {language || 'text'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          title="Copy"
        >
          <CopyIcon className="size-3.5" /> copy
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  )
}

function McpTransportIcon({ transport }: { transport: string }) {
  const isHttp = transport === 'http' || transport === 'sse'
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
      {isHttp ? <GlobeIcon className="size-4" /> : <ServerIcon className="size-4" />}
    </div>
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

function SkillsTab({ agent }: { agent: Agent }) {
  const [skills, setSkills] = useState<AgentSkill[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listAgentSkills(agent.id)
      .then(setSkills)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [agent.id])

  const filtered = useMemo(() => {
    if (!skills) return []
    const q = query.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    )
  }, [skills, query])

  const enabledCount = skills?.filter((s) => s.status === 'enabled').length ?? 0

  async function onToggle(skill: AgentSkill) {
    if (!skills) return
    const before = skills
    const optimistic = skills.map((s) =>
      s.id === skill.id ? { ...s, status: s.status === 'enabled' ? 'disabled' as const : 'enabled' as const } : s,
    )
    setSkills(optimistic)
    try {
      await toggleAgentSkill(agent.id, skill.id)
    } catch (err) {
      setSkills(before)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Skills</CardTitle>
            <p className="text-xs text-muted-foreground">
              {skills === null
                ? 'lade…'
                : `${enabledCount} von ${skills.length} aktiviert · Klick auf Switch zum Umschalten`}
            </p>
          </div>
          <div className="relative w-64">
            <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Skills filtern…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              data-testid="skills-search"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : skills === null ? (
          <p className="text-sm text-muted-foreground">lade Skills…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Skills für „{query}" gefunden.</p>
        ) : (
          <ul className="divide-y divide-border/60" data-testid="skills-list">
            {filtered.map((skill) => (
              <li key={skill.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium" data-testid={`skill-name-${skill.name}`}>
                      {skill.name}
                    </span>
                    {skill.category ? (
                      <Badge variant="secondary" className="text-xs">
                        {skill.category}
                      </Badge>
                    ) : null}
                  </div>
                  {skill.description ? (
                    <p className="truncate text-xs text-muted-foreground">{skill.description}</p>
                  ) : null}
                </div>
                <Switch
                  checked={skill.status === 'enabled'}
                  onCheckedChange={() => onToggle(skill)}
                  aria-label={`${skill.name} ${skill.status === 'enabled' ? 'deaktivieren' : 'aktivieren'}`}
                  data-testid={`skill-toggle-${skill.name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
