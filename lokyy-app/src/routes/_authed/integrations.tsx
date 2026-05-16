import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  CalendarIcon,
  MailIcon,
  StickyNoteIcon,
  CheckCircle2Icon,
  PowerIcon,
  GithubIcon,
  ZapIcon,
  MessageSquareIcon,
  ChartBarIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  type IntegrationProvider,
} from '@/lib/lokyy-integrations'

const ICONS: Record<string, typeof CalendarIcon> = {
  'google-calendar': CalendarIcon,
  gmail: MailIcon,
  notion: StickyNoteIcon,
  linear: ChartBarIcon,
  slack: MessageSquareIcon,
  github: GithubIcon,
}

export const Route = createFileRoute('/_authed/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationProvider[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function refresh() {
    try {
      setIntegrations(await listIntegrations())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onToggle(p: IntegrationProvider) {
    setBusy(p.id)
    try {
      if (p.status === 'connected') {
        if (!confirm(`${p.name} trennen?`)) return
        await disconnectIntegration(p.id)
      } else {
        await connectIntegration(p.id)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const connected = integrations?.filter((i) => i.status === 'connected').length ?? 0
  const total = integrations?.length ?? 0

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Verbinde Lokyy mit deinen Tools. Diese sind kuratierte Provider — separat vom MCP-Hub.
          {integrations ? ` ${connected}/${total} verbunden.` : ''}
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {integrations === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade…</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="integrations-grid">
          {integrations.map((p) => {
            const Icon = ICONS[p.id] ?? ZapIcon
            return (
              <Card key={p.id} data-testid={`integration-card-${p.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-10 items-center justify-center rounded-md bg-muted/50">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    {p.status === 'connected' ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2Icon className="size-3" /> verbunden
                      </Badge>
                    ) : (
                      <Badge variant="secondary">offen</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-3 text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  <Button
                    variant={p.status === 'connected' ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => onToggle(p)}
                    disabled={busy === p.id}
                    className="w-full"
                    data-testid={`integration-toggle-${p.id}`}
                  >
                    <PowerIcon className="size-3" />
                    {p.status === 'connected' ? 'Trennen' : 'Verbinden'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
