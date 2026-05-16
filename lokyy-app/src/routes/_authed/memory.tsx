import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BrainIcon, CheckCircle2Icon, KeyIcon, HardDriveIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchMemory, type MemoryStatus } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/memory')({ component: MemoryPage })

function MemoryPage() {
  const [status, setStatus] = useState<MemoryStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { fetchMemory().then(setStatus).catch((e) => setError(String(e))) }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Memory</h1>
        <p className="text-sm text-muted-foreground">
          Hermes-Memory: Built-in (MEMORY.md/USER.md) ist immer aktiv. Externe Provider können dazugeschaltet werden.
        </p>
      </div>

      {error ? <Card><CardContent className="p-6"><p className="text-sm text-destructive">{error}</p></CardContent></Card> :
       !status ? <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">lade…</p></CardContent></Card> :
      (<>
        <Card data-testid="memory-status">
          <CardHeader>
            <CardTitle className="text-base">Aktiver Memory-Stack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-green-600" />
              <span className="text-sm">Built-in (MEMORY.md / USER.md)</span>
              <Badge variant="secondary" className="text-xs">always active</Badge>
            </div>
            <div className="flex items-center gap-2">
              <HardDriveIcon className="size-4 text-muted-foreground" />
              <span className="text-sm">Externer Provider: <strong>{status.activeProvider ?? 'none'}</strong></span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Verfügbare Provider</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60" data-testid="memory-providers">
              {status.installedProviders.map((p) => (
                <li key={p.name} className="flex items-center gap-3 py-3" data-testid={`memory-provider-${p.name}`}>
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted/50">
                    <BrainIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.mode}</p>
                  </div>
                  {p.requiresKey ? <Badge variant="outline" className="text-xs"><KeyIcon className="mr-1 size-3" />API Key</Badge> : null}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Setup-Wizard: <code className="rounded bg-muted px-1">hermes memory setup</code> (interaktiv)
            </p>
          </CardContent>
        </Card>
      </>)}
    </div>
  )
}
