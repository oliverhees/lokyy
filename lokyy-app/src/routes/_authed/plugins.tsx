import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PuzzleIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchPlugins, type Plugin } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/plugins')({ component: PluginsPage })

function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [raw, setRaw] = useState('')

  useEffect(() => {
    fetchPlugins().then((d) => { setPlugins(d.plugins); setRaw(d.raw) }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Plugins</h1>
        <p className="text-sm text-muted-foreground">Git-basierte Hermes-Plugins. Install via <code className="rounded bg-muted px-1">hermes plugins install &lt;repo&gt;</code></p>
      </div>

      {plugins.length === 0 ? (
        <Card><CardContent className="p-6">
          <PuzzleIcon className="mx-auto mb-2 size-12 text-muted-foreground/50" />
          <p className="text-center text-sm text-muted-foreground">Keine Plugins installiert.</p>
          {raw ? <pre className="mt-4 whitespace-pre-wrap text-xs text-muted-foreground">{raw}</pre> : null}
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{plugins.length} Plugin{plugins.length === 1 ? '' : 's'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60" data-testid="plugins-list">
              {plugins.map((p) => (
                <li key={p.name} className="flex items-center gap-3 px-6 py-3">
                  <PuzzleIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <Badge variant={p.status.includes('not') ? 'secondary' : 'default'} className="text-xs">{p.status}</Badge>
                      <Badge variant="outline" className="text-xs">{p.version}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{p.source}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
