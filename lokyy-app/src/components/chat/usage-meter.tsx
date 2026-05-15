import { ZapIcon } from 'lucide-react'

const CONTEXT_WINDOWS: Record<string, number> = {
  'claude-sonnet-4-6': 200_000,
  'claude-opus-4-6': 200_000,
  'claude-opus-4-7': 200_000,
  'claude-haiku-4-5': 200_000,
  'gpt-5': 400_000,
  'gpt-4o': 128_000,
  'hermes-agent': 200_000,
}

function approximateTokens(text: string): number {
  // Heuristik: ~4 Zeichen pro Token (multilingual avg)
  return Math.ceil(text.length / 4)
}

export function UsageMeter({
  model,
  messages,
}: {
  model: string
  messages: Array<{ content: string }>
}) {
  const total = messages.reduce((sum, m) => sum + approximateTokens(m.content), 0)
  const ctx = CONTEXT_WINDOWS[model] ?? 100_000
  const pct = Math.min(100, (total / ctx) * 100)

  const color =
    pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="usage-meter">
      <ZapIcon className="size-3.5" />
      <div className="flex items-center gap-1.5">
        <span className="font-mono tabular-nums">
          {formatTokens(total)} / {formatTokens(ctx)}
        </span>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono tabular-nums">{pct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}
