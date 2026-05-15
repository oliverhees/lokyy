import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { WrenchIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchTools, type Tool } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/tools')({ component: ToolsPage })

function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  useEffect(() => { fetchTools().then((d) => setTools(d.tools)).catch(() => {}) }, [])

  const enabled = tools.filter((t) => t.enabled)
  const disabled = tools.filter((t) => !t.enabled)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Built-in Toolsets von Hermes ({enabled.length} aktiv, {disabled.length} aus).
          Toggle via <code className="rounded bg-muted px-1">hermes tools enable/disable</code>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-testid="tools-grid">
        {tools.map((t) => (
          <Card key={t.name} className={t.enabled ? '' : 'opacity-60'}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{t.emoji}</span>
                  {t.name}
                </CardTitle>
                {t.enabled ? <Badge>aktiv</Badge> : <Badge variant="secondary">aus</Badge>}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </CardContent>
          </Card>
        ))}
        {tools.length === 0 ? (
          <Card><CardContent className="p-6">
            <WrenchIcon className="mx-auto mb-2 size-12 text-muted-foreground/50" />
            <p className="text-center text-sm text-muted-foreground">lade Tools…</p>
          </CardContent></Card>
        ) : null}
      </div>
    </div>
  )
}
