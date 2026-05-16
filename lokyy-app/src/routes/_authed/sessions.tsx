import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SearchIcon, MessageSquareIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { listSessions, formatRelativeTime, type HermesSession } from '@/lib/lokyy-sessions'

export const Route = createFileRoute('/_authed/sessions')({
  component: SessionsPage,
})

function SessionsPage() {
  const [sessions, setSessions] = useState<HermesSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const filtered = useMemo(() => {
    if (!sessions) return []
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q),
    )
  }, [sessions, query])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Alle Hermes-Sessions sortiert nach letztem Update. {sessions ? `${sessions.length} insgesamt.` : ''}
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : sessions === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade Sessions…</p>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Keine Sessions gefunden.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{filtered.length} Sessions</CardTitle>
              <div className="relative w-72">
                <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter (id, model, platform)…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8"
                  data-testid="sessions-search"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60" data-testid="sessions-list">
              {filtered.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/40"
                  data-testid={`session-row-${s.id}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <MessageSquareIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="truncate text-sm font-medium" title={s.id}>{s.id}</code>
                      <Badge variant="secondary" className="text-xs">{s.platform}</Badge>
                      <Badge variant="outline" className="text-xs">{s.provider}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{s.model}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-medium">{s.messageCount} msg</p>
                    <p className="text-xs text-muted-foreground" title={s.lastUpdated}>
                      {formatRelativeTime(s.lastUpdated)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
