import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BrainIcon, CloudIcon, FolderIcon, KeyIcon, LoaderIcon, CheckIcon, AlertCircleIcon, CopyIcon, GitBranchIcon, WandSparklesIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  getVaultStatus,
  getVaultSshKey,
  vaultSetupLocal,
  vaultSetupRemoteInit,
  vaultImportRemote,
  vaultImportLocalPath,
  httpsToSsh,
  looksLikeSshUrl,
} from '@/lib/lokyy-vault'

export const Route = createFileRoute('/_authed/vault/setup')({ component: VaultSetupPage })

type Mode = null | 'local' | 'remote-init' | 'remote-clone' | 'localPath'

function VaultSetupPage() {
  const navigate = useNavigate()
  const [statusLoading, setStatusLoading] = useState(true)
  const [alreadyConfigured, setAlreadyConfigured] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [sshPublicKey, setSshPublicKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const s = await getVaultStatus()
        setAlreadyConfigured(s.configured)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setStatusLoading(false)
      }
    })()
  }, [])

  // Lazy-fetch SSH key the moment user picks a remote-mode (so they can
  // copy it to Forgejo BEFORE clicking "Initialisieren").
  useEffect(() => {
    if (mode !== 'remote-init' && mode !== 'remote-clone') return
    if (sshPublicKey) return
    void getVaultSshKey()
      .then((k) => setSshPublicKey(k.publicKey))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [mode, sshPublicKey])

  async function copySshKey() {
    if (!sshPublicKey) return
    await navigator.clipboard.writeText(sshPublicKey)
    toast.success('Public Key kopiert')
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      let result: { error?: string; ok?: boolean } | null = null
      if (mode === 'local') {
        result = await vaultSetupLocal()
      } else if (mode === 'remote-init') {
        if (!remoteUrl.trim()) {
          setError('Remote-URL fehlt')
          return
        }
        result = await vaultSetupRemoteInit(remoteUrl.trim())
      } else if (mode === 'remote-clone') {
        if (!remoteUrl.trim()) {
          setError('Remote-URL fehlt')
          return
        }
        result = await vaultImportRemote(remoteUrl.trim())
      } else if (mode === 'localPath') {
        if (!localPath.trim()) {
          setError('Container-Pfad fehlt')
          return
        }
        result = await vaultImportLocalPath(localPath.trim())
      }
      if (!result?.ok) {
        setError(result?.error ?? 'Setup fehlgeschlagen')
        return
      }
      toast.success('Second Brain initialisiert')
      void navigate({ to: '/vault' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (statusLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <LoaderIcon className="size-4 animate-spin" /> Status wird geprüft…
      </div>
    )
  }

  if (alreadyConfigured) {
    return (
      <Card data-testid="vault-setup-already-configured">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckIcon className="size-5 text-green-500" /> Second Brain ist schon eingerichtet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Es gibt bereits ein konfiguriertes Vault. Re-Setup ist destruktiv — wipe geht über die
            Settings (kommt mit Story F4).
          </p>
          <Button onClick={() => void navigate({ to: '/vault' })} data-testid="vault-setup-goto-vault">
            Zum Vault
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6" data-testid="vault-setup-page">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight lg:text-2xl">
          <BrainIcon className="size-6" /> Second Brain einrichten
        </h1>
        <p className="text-sm text-muted-foreground">
          Wähle wie dein Vault leben soll. <strong>Local-only</strong> = die Notizen liegen nur auf
          diesem Server. <strong>Remote</strong> = ein Git-Repo (Forgejo, GitHub, GitLab) wird als
          Backup + Sync-Ziel angebunden.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircleIcon className="size-5 shrink-0 text-destructive" />
            <pre className="whitespace-pre-wrap text-xs text-destructive" data-testid="vault-setup-error">{error}</pre>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModeCard
          icon={<FolderIcon className="size-5" />}
          title="Local-only — neuer Vault"
          desc="Lokyy legt einen frischen Start-Vault an (README, Inbox, Daily, Projects, Templates). Kein Remote, keine Sync."
          selected={mode === 'local'}
          onPick={() => setMode('local')}
          testid="vault-mode-local"
        />
        <ModeCard
          icon={<FolderIcon className="size-5" />}
          title="Local-only — existierenden Ordner importieren"
          desc="Container-Pfad zu einem vorhandenen Markdown-Ordner. Wird in /app/vault kopiert. Optional — nur wenn du ein Vault aus einem Host-Mount übernehmen willst."
          selected={mode === 'localPath'}
          onPick={() => setMode('localPath')}
          testid="vault-mode-localPath"
        />
        <ModeCard
          icon={<CloudIcon className="size-5" />}
          title="Remote — neues Repo (init + push)"
          desc="Lokyy legt einen Start-Vault an und pusht ihn ins angegebene Git-Repo. Repo muss leer sein, SSH-URL."
          selected={mode === 'remote-init'}
          onPick={() => setMode('remote-init')}
          testid="vault-mode-remote-init"
        />
        <ModeCard
          icon={<GitBranchIcon className="size-5" />}
          title="Remote — existierendes Repo clonen"
          desc="Lokyy clont das angegebene Repo nach /app/vault. Repo enthält schon dein Vault, SSH-URL."
          selected={mode === 'remote-clone'}
          onPick={() => setMode('remote-clone')}
          testid="vault-mode-remote-clone"
        />
      </div>

      {(mode === 'remote-init' || mode === 'remote-clone') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyIcon className="size-5" /> SSH Public Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bevor du auf Initialisieren klickst: hinterleg diesen Public Key bei deinem Git-Host
              (Forgejo / GitHub / GitLab Deploy Key mit Write-Berechtigung).
            </p>
            {sshPublicKey ? (
              <>
                <pre
                  className="overflow-x-auto rounded bg-muted p-3 font-mono text-[11px] leading-relaxed"
                  data-testid="vault-setup-ssh-key"
                >
                  {sshPublicKey}
                </pre>
                <Button variant="outline" size="sm" onClick={() => void copySshKey()} data-testid="vault-setup-ssh-copy">
                  <CopyIcon className="size-4" /> Kopieren
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderIcon className="size-4 animate-spin" /> Key wird generiert…
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="vault-remote-url">Remote-URL (SSH)</Label>
              <Input
                id="vault-remote-url"
                placeholder="git@forgejo.example.com:user/my-vault.git"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                data-testid="vault-setup-remote-url"
              />
              {(() => {
                if (!remoteUrl.trim()) return null
                if (looksLikeSshUrl(remoteUrl)) {
                  return (
                    <p className="text-xs text-green-600" data-testid="vault-url-ok">
                      ✓ SSH-Format erkannt.
                    </p>
                  )
                }
                const suggested = httpsToSsh(remoteUrl)
                if (suggested) {
                  return (
                    <div
                      className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs"
                      data-testid="vault-url-https-warning"
                    >
                      <AlertCircleIcon className="size-4 shrink-0 text-yellow-600" />
                      <div className="flex-1 space-y-1">
                        <p>
                          Das sieht nach einer HTTPS-URL aus. Lokyy nutzt SSH-Keys, kein HTTPS-Token.
                          Konvertierte SSH-URL:
                        </p>
                        <code className="block rounded bg-muted px-2 py-1 font-mono">{suggested}</code>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRemoteUrl(suggested)}
                        data-testid="vault-url-convert"
                      >
                        <WandSparklesIcon className="size-3" /> Übernehmen
                      </Button>
                    </div>
                  )
                }
                return (
                  <p className="text-xs text-destructive" data-testid="vault-url-unrecognized">
                    URL-Format unbekannt. Erwartet: <code>git@host:user/repo.git</code>
                  </p>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'localPath' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Container-Pfad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Absoluter Pfad <em>innerhalb</em> des lokyy-os-be Containers (z.B. ein per
              docker-compose gemounteter Host-Folder). Wird einmal kopiert, danach lebt der Vault
              in <code className="rounded bg-muted px-1">/app/vault</code>.
            </p>
            <Input
              id="vault-local-path"
              placeholder="/host-vault"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              data-testid="vault-setup-local-path"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={!mode || submitting}
          onClick={() => void submit()}
          data-testid="vault-setup-submit"
        >
          {submitting ? <LoaderIcon className="size-4 animate-spin" /> : null}
          Initialisieren
        </Button>
      </div>
    </div>
  )
}

function ModeCard(props: {
  icon: React.ReactNode
  title: string
  desc: string
  selected: boolean
  onPick: () => void
  testid: string
}) {
  return (
    <button
      type="button"
      onClick={props.onPick}
      data-testid={props.testid}
      data-selected={props.selected}
      className={
        'text-left rounded-lg border p-4 transition ' +
        (props.selected
          ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
          : 'border-border hover:border-primary/40')
      }
    >
      <div className="flex items-center gap-2 font-medium">
        {props.icon}
        {props.title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{props.desc}</p>
    </button>
  )
}
