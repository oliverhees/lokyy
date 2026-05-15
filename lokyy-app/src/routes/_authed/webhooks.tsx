import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { WebhookIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { fetchWebhooks, type WebhooksData } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/webhooks')({ component: WebhooksPage })

function WebhooksPage() {
  const [data, setData] = useState<WebhooksData | null>(null)
  useEffect(() => { fetchWebhooks().then(setData).catch(() => setData({ enabled: false, webhooks: [], raw: '' })) }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Webhooks</h1>
        <p className="text-sm text-muted-foreground">Event-driven Agent-Aktivierung via HTTP-Webhooks.</p>
      </div>

      {!data ? <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">lade…</p></CardContent></Card> :
       !data.enabled ? (
        <Card>
          <CardContent className="p-6 text-center" data-testid="webhooks-disabled">
            <WebhookIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Webhook-Platform nicht aktiviert</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Setup: <code className="rounded bg-muted px-1">hermes gateway setup</code> oder manuell in <code className="rounded bg-muted px-1">~/.hermes/config.yaml</code> platforms.webhook.enabled: true
            </p>
            <pre className="mt-4 whitespace-pre-wrap text-left text-xs text-muted-foreground">{data.raw}</pre>
          </CardContent>
        </Card>
       ) : (
        <Card>
          <CardContent className="p-6">
            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground" data-testid="webhooks-output">{data.raw}</pre>
          </CardContent>
        </Card>
       )}
    </div>
  )
}
