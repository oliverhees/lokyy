import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChartBarIcon, MessageSquareIcon, WrenchIcon, ClockIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchInsights, type InsightsData } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/insights')({ component: InsightsPage })

function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInsights(30).then(setData).catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Insights</h1>
        <p className="text-sm text-muted-foreground">Token-Verbrauch und Tool-Patterns der letzten 30 Tage.</p>
      </div>

      {error ? (
        <Card><CardContent className="p-6"><p className="text-sm text-destructive">{error}</p></CardContent></Card>
      ) : !data ? (
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">lade…</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="insights-stats">
            <StatCard icon={<MessageSquareIcon className="size-5" />} label="Sessions" value={data.summary.sessions ?? '–'} />
            <StatCard icon={<MessageSquareIcon className="size-5" />} label="Messages" value={data.summary.messages ?? '–'} />
            <StatCard icon={<WrenchIcon className="size-5" />} label="Tool Calls" value={data.summary.toolCalls ?? '–'} />
            <StatCard icon={<ChartBarIcon className="size-5" />} label="Total Tokens" value={data.summary.totalTokens?.toLocaleString() ?? '–'} />
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <ClockIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Active Time: {data.summary.activeTime ?? '–'}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">{data.raw}</pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
