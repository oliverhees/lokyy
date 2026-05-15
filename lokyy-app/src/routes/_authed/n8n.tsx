import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ZapIcon, ExternalLinkIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { readSettings } from '@/lib/lokyy-settings'

export const Route = createFileRoute('/_authed/n8n')({
  component: N8nPage,
})

function N8nPage() {
  const [url, setUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    readSettings()
      .then((s) => setUrl(s.n8nUrl))
      .catch(() => setUrl(null))
  }, [])

  if (url === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">n8n</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">n8n</h1>
          <p className="text-sm text-muted-foreground">
            Workflow-Automatisierung embedded in Lokyy. Konfiguriere die URL in den Settings.
          </p>
        </div>
        <Card>
          <CardContent className="p-6 text-center" data-testid="n8n-empty">
            <ZapIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">n8n-URL nicht konfiguriert</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gehe in die Settings und trage die URL deiner n8n-Instanz ein.
            </p>
            <Button asChild className="mt-4">
              <Link to="/settings">Settings öffnen</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">n8n</h1>
          <p className="text-xs text-muted-foreground">
            embedded: <code className="rounded bg-muted px-1">{url}</code>
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="size-3.5" />
            In neuem Tab öffnen
          </a>
        </Button>
      </div>
      <Card className="flex-1 overflow-hidden p-0">
        <iframe
          src={url}
          title="n8n"
          className="size-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
          data-testid="n8n-iframe"
        />
      </Card>
    </div>
  )
}
