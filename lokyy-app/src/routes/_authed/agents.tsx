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
        <Button disabled data-testid="agents-add" variant="outline">
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
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
      className="group block cursor-not-allowed"
      data-testid={`agent-card-${agent.id}`}
      title="Detail-Seite kommt in Phase 1.2"
    >
      <Card className="overflow-hidden border-transparent transition-all hover:border-primary/40 hover:shadow-lg">
        <div
          className="relative h-32 w-full"
          style={{ background: gradientForAgent(agent.id) }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold text-white/90 drop-shadow-md">
              {initialsFor(agent.name)}
            </span>
          </div>
          {agent.isDefault ? (
            <Badge variant="secondary" className="absolute right-2 top-2 bg-white/90 text-zinc-900">
              Default
            </Badge>
          ) : null}
        </div>
        <CardHeader className="space-y-1 pb-2">
          <h3 className="truncate font-semibold leading-tight">{agent.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{agent.model}</p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {agent.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
        </CardContent>
      </Card>
    </div>
  )
}

function AgentSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-32 w-full rounded-none" />
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
