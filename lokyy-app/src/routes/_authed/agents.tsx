import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PlusIcon, KeyIcon, BrainCircuitIcon, ZapIcon } from 'lucide-react'
import { listAgents, gradientForAgent, initialsFor, type Agent } from '@/lib/lokyy-agents'

export const Route = createFileRoute('/_authed/agents')({
  component: AgentsGalleryPage,
})

function AgentsGalleryPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Deine Hermes-Profile als Lokyy-Agents. Klick einen an, um ihn zu konfigurieren oder zu chatten.
          </p>
        </div>
        <Button
          data-testid="agents-add"
          title="Kommt in einer späteren Phase"
          className="cursor-not-allowed"
          onClick={(e) => e.preventDefault()}
        >
          <PlusIcon className="size-4" />
          Neuer Agent
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">Konnte Agents nicht laden: {error}</p>
          </CardContent>
        </Card>
      ) : agents === null ? (
        <AgentSkeletonGrid />
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Keine Hermes-Profile gefunden. Lege eines an mit:{' '}
              <code className="rounded bg-muted px-1">hermes profile create &lt;name&gt;</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
          data-testid="agents-grid"
        >
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      className="group block h-full cursor-not-allowed"
      data-testid={`agent-card-${agent.id}`}
      title="Detail-Seite kommt in Phase 1.2"
    >
      <Card className="relative flex h-full flex-col gap-6 overflow-hidden rounded-xl border border-border/60 pt-6 pb-0 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        {agent.isDefault ? (
          <Badge variant="secondary" className="absolute right-3 top-3 z-10">
            Default
          </Badge>
        ) : null}
        <CardContent className="flex flex-1 flex-col items-center gap-2 px-4 pb-3 pt-3 text-center">
          <div
            className="flex size-28 items-center justify-center rounded-full text-3xl font-bold text-white shadow-inner ring-4 ring-background"
            style={{ background: gradientForAgent(agent.id) }}
            aria-hidden
          >
            {initialsFor(agent.name)}
          </div>
          <div className="space-y-1">
            <h3 className="truncate font-semibold leading-tight">{agent.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{agent.model}</p>
          </div>
          {agent.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
          ) : null}
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
    </div>
  )
}

function AgentSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-xl border border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 px-4 pb-4 pt-3 text-center">
            <Skeleton className="size-28 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-44" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
