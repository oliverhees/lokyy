import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BrainIcon, RefreshCwIcon, AlertCircleIcon, LoaderIcon, FolderIcon, CloudIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getVaultStatus, vaultSync, vaultReset, type VaultStatus, type VaultSyncResult } from '@/lib/lokyy-vault'

function relTime(ms: number | null): string {
  if (!ms) return 'noch nie'
  const delta = Date.now() - ms
  if (delta < 60_000) return 'gerade eben'
  if (delta < 3_600_000) return `vor ${Math.floor(delta / 60_000)} min`
  if (delta < 86_400_000) return `vor ${Math.floor(delta / 3_600_000)} h`
  return `vor ${Math.floor(delta / 86_400_000)} d`
}

export function VaultStatusHeader() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function refresh() {
    try {
      setStatus(await getVaultStatus())
    } catch (err) {
      console.error('vault status fetch failed', err)
    }
  }

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!status || !status.configured) return null

  const isRemote = status.mode === 'remote'

  async function onSync() {
    setSyncing(true)
    try {
      const r: VaultSyncResult = await vaultSync()
      if (!r.ok) {
        toast.error(`Sync fehlgeschlagen (${r.step}): ${r.error.slice(0, 200)}`)
      } else if (r.skipped) {
        toast.info(`Übersprungen: ${r.reason}`)
      } else {
        const parts = [
          r.committed ? 'committed' : 'nichts zu committen',
          r.pulled === 'up to date' ? 'pull up-to-date' : 'pull ok',
          r.pushed === 'up to date' ? 'push up-to-date' : 'push ok',
        ]
        toast.success(`Synced — ${parts.join(' · ')}`)
      }
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  async function onResetup() {
    if (!confirm('Vault zurücksetzen? Das wipe-t alle Notizen in /app/vault und entfernt den Remote-Link. Wenn du ein Remote-Repo hast bleiben die Daten dort, kannst danach via Clone wieder importieren.')) {
      return
    }
    await vaultReset()
    toast.info('Vault zurückgesetzt')
    void navigate({ to: '/vault/setup' })
  }

  return (
    <Card data-testid="vault-status-header">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <BrainIcon className="size-5 text-muted-foreground" />
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Second Brain</span>
            <Badge variant={isRemote ? 'default' : 'secondary'} className="gap-1" data-testid="vault-mode-badge">
              {isRemote ? <CloudIcon className="size-3" /> : <FolderIcon className="size-3" />}
              {isRemote ? 'Remote' : 'Local-only'}
            </Badge>
            {isRemote && status.remoteUrl ? (
              <code className="truncate rounded bg-muted px-1 text-xs" title={status.remoteUrl}>
                {status.remoteUrl}
              </code>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span data-testid="vault-last-sync">
              {isRemote ? `Letzte Sync: ${relTime(status.lastSyncAt)}` : 'Kein Remote — nur lokal'}
            </span>
            {status.syncError ? (
              <span className="flex items-center gap-1 text-destructive" data-testid="vault-sync-error">
                <AlertCircleIcon className="size-3" />
                <span className="truncate" title={status.syncError}>{status.syncError.slice(0, 80)}</span>
              </span>
            ) : null}
          </div>
        </div>
        {isRemote ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onSync()}
            disabled={syncing}
            data-testid="vault-sync-now"
          >
            {syncing ? <LoaderIcon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Sync now
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onResetup()}
          className="text-destructive hover:text-destructive"
          data-testid="vault-resetup"
        >
          Re-setup
        </Button>
      </CardContent>
    </Card>
  )
}
