import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PlusIcon, KeyIcon, BrainCircuitIcon, ZapIcon, PencilIcon, TrashIcon, BotIcon, SparklesIcon } from 'lucide-react'
import { listAgents, gradientForAgent, initialsFor, type Agent } from '@/lib/lokyy-agents'
import { listMyAgents, deleteMyAgent, type LokyyAgent } from '@/lib/lokyy-my-agents'
import { LokyyAgentEditor } from '@/components/lokyy/lokyy-agent-editor'

export const Route = createFileRoute('/_authed/agents/')({
  component: AgentsGalleryPage,
})

function AgentsGalleryPage() {
  const [systemAgents, setSystemAgents] = useState<Agent[] | null>(null)
  const [myAgents, setMyAgents] = useState<LokyyAgent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<LokyyAgent | undefined>(undefined)

  function reload() {
    listAgents().then(setSystemAgents).catch((e) => setError(String(e)))
    listMyAgents().then(setMyAgents).catch((e) => setError(String(e)))
  }
  useEffect(reload, [])

  async function onDelete(agent: LokyyAgent) {
    if (!confirm(`«${agent.name}» wirklich löschen?`)) return
    try {
      await deleteMyAgent(agent.id)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Deine eigenen Lokyy-Agents (custom prompts + curated skills) und die Hermes-System-Profile read-only.
          </p>
        </div>
        <Button
          data-testid="agents-add"
          onClick={() => {
            setEditing(undefined)
            setEditorOpen(true)
          }}
        >
          <PlusIcon className="size-4" />
          Neuer Agent
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/50 text-destructive rounded-md px-4 py-3 text-sm">{error}</div>
      )}

      {/* Section 1: Lokyy-Agents (user-created, editable) */}
      <section className="space-y-3" data-testid="lokyy-agents-section">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BotIcon className="size-4 text-primary" />
            Meine Agents
          </h2>
          <Badge variant="outline" className="text-[10px]">
            user-created · editable
          </Badge>
        </div>
        {myAgents === null ? (
          <AgentSkeletonGrid />
        ) : myAgents.length === 0 ? (
          <Card data-testid="lokyy-agents-empty">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <SparklesIcon className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Noch kein eigener Agent</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Klick «Neuer Agent», definiere System-Prompt + wähle Skills aus. Im Workflow-Editor kannst du den Agent dann als Node nutzen.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" data-testid="lokyy-agents-grid">
            {myAgents.map((a) => (
              <LokyyAgentCard
                key={a.id}
                agent={a}
                onEdit={() => {
                  setEditing(a)
                  setEditorOpen(true)
                }}
                onDelete={() => onDelete(a)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: System Agents (Hermes-Profiles, read-only) */}
      <section className="space-y-3" data-testid="system-agents-section">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BrainCircuitIcon className="size-4 text-fuchsia-500" />
            System Agents (Hermes Profile)
          </h2>
          <Badge variant="outline" className="text-[10px]">
            CLI-managed · read-only
          </Badge>
        </div>
        {systemAgents === null ? (
          <AgentSkeletonGrid />
        ) : systemAgents.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Keine Hermes-Profile gefunden. Lege eines an mit:{' '}
                <code className="rounded bg-muted px-1">hermes profile create &lt;name&gt;</code>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="agents-grid">
            {systemAgents.map((a) => (
              <SystemAgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </section>

      <LokyyAgentEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        onSaved={() => reload()}
      />
    </div>
  )
}

function LokyyAgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: LokyyAgent
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="flex flex-col" data-testid={`lokyy-agent-card-${agent.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BotIcon className="size-4 text-primary shrink-0" />
            <CardTitle className="text-sm truncate">{agent.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Bearbeiten">
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Löschen"
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono truncate">{agent.id}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 text-xs text-muted-foreground">
        {agent.description && <p className="line-clamp-2">{agent.description}</p>}
        <div className="flex flex-wrap gap-1 mt-auto">
          <Badge variant="secondary" className="text-[10px]">
            <ZapIcon className="size-3 mr-0.5" /> {agent.skills.length} Skills
          </Badge>
          {agent.mcps.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              <KeyIcon className="size-3 mr-0.5" /> {agent.mcps.length} MCPs
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">{agent.model}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function SystemAgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      to="/agents/$agentId"
      params={{ agentId: agent.id }}
      className="group block h-full"
      data-testid={`agent-card-${agent.id}`}
    >
      <Card className="relative flex h-full flex-col gap-6 overflow-hidden rounded-xl border border-border/60 pt-6 pb-0 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        {agent.isDefault ? (
          <Badge variant="secondary" className="absolute right-3 top-3 z-10">
            Default
          </Badge>
        ) : null}
        <CardContent className="flex flex-1 flex-col items-center gap-2 px-4 pb-3 pt-3 text-center">
          <div
            className="flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-inner ring-4 ring-background"
            style={{ background: gradientForAgent(agent.id) }}
            aria-hidden
          >
            {initialsFor(agent.name)}
          </div>
          <div className="space-y-1">
            <h3 className="truncate font-semibold leading-tight">{agent.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{agent.model}</p>
          </div>
        </CardContent>
        <div
          className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 text-xs leading-none text-muted-foreground"
          style={{ paddingTop: 10, paddingBottom: 10 }}
        >
          <span className="flex items-center gap-1" title="Skills">
            <ZapIcon className="size-3.5" /> {agent.skillCount}
          </span>
          <span className="flex items-center gap-1" title="MCP-Server">
            <KeyIcon className="size-3.5" /> {agent.mcpCount}
          </span>
          <span
            className={`flex items-center gap-1 ${agent.hasSoul ? '' : 'opacity-40'}`}
            title={agent.hasSoul ? 'Hat SOUL.md' : 'Keine SOUL.md'}
          >
            <BrainCircuitIcon className="size-3.5" /> SOUL
          </span>
        </div>
      </Card>
    </Link>
  )
}

function AgentSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
