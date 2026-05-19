import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SaveIcon, BrainIcon, ZapIcon, MicIcon, Volume2Icon, StethoscopeIcon, DownloadIcon, SparklesIcon, SettingsIcon, BellIcon, ServerIcon, CircleIcon } from 'lucide-react'
import { fetchDoctor, fetchBackup, fetchCurator } from '@/lib/lokyy-hermes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { readSettings, patchSettings, type LokyySettings } from '@/lib/lokyy-settings'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const [settings, setSettings] = useState<LokyySettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    readSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  async function save(patch: Partial<LokyySettings>) {
    try {
      const next = await patchSettings(patch)
      setSettings(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Settings</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!settings) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Settings</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasLegacyVault = settings.vaultPath !== undefined
  const hasLegacyN8n = settings.n8nUrl !== undefined
  const hasLegacyVoice = settings.ttsEnabled !== undefined || settings.sttEnabled !== undefined

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Lokyy-Konfiguration. Änderungen werden sofort gespeichert.
          {saved ? <span className="ml-2 text-primary">✓ gespeichert</span> : null}
        </p>
      </div>

      <GeneralCard general={settings.general} />
      <NotificationsCard notifications={settings.notifications} />
      <HermesConfigCard
        hermes={settings.hermes ?? null}
        hermesLive={settings.hermesLive ?? false}
        hermesError={settings.hermesError}
      />

      {hasLegacyVault ? (
        <Card data-testid="settings-vault">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BrainIcon className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Second Brain — Vault-Pfad</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Absoluter Pfad zu deinem Obsidian-Vault. Überschreibt die Env-Variable{' '}
              <code className="rounded bg-muted px-1">LOKYY_VAULT_PATH</code>.
            </p>
            <PathInput
              initial={settings.vaultPath ?? ''}
              placeholder="/home/oliver/Documents/MyVault"
              onSave={(v) => save({ vaultPath: v || null })}
              testid="settings-vault-path"
            />
          </CardContent>
        </Card>
      ) : null}

      {hasLegacyN8n ? (
        <Card data-testid="settings-n8n">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZapIcon className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">n8n — Embed-URL</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              URL deiner n8n-Instanz. Wird auf <code className="rounded bg-muted px-1">/n8n</code> als iframe eingebettet.
            </p>
            <PathInput
              initial={settings.n8nUrl ?? ''}
              placeholder="http://localhost:5678"
              onSave={(v) => save({ n8nUrl: v || null })}
              testid="settings-n8n-url"
            />
          </CardContent>
        </Card>
      ) : null}

      <HermesAdminCard />

      {hasLegacyVoice ? (
        <Card data-testid="settings-voice">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MicIcon className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Voice — TTS & Spracheingabe</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="tts" className="flex items-center gap-2">
                  <Volume2Icon className="size-4" /> Text-to-Speech
                </Label>
                <p className="text-xs text-muted-foreground">
                  Speaker-Button auf Agent-Antworten zum Vorlesen.
                </p>
              </div>
              <Switch
                id="tts"
                checked={settings.ttsEnabled ?? false}
                onCheckedChange={(v) => save({ ttsEnabled: v })}
                data-testid="settings-tts-toggle"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="stt" className="flex items-center gap-2">
                  <MicIcon className="size-4" /> Speech-to-Text
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mic-Button im Chat-Input für Spracheingabe (browser-abhängig).
                </p>
              </div>
              <Switch
                id="stt"
                checked={settings.sttEnabled ?? false}
                onCheckedChange={(v) => save({ sttEnabled: v })}
                data-testid="settings-stt-toggle"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function GeneralCard({ general }: { general: LokyySettings['general'] }) {
  const theme = general?.theme ?? '—'
  const language = general?.language ?? '—'
  return (
    <Card data-testid="settings-general">
      <CardHeader>
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-5 text-muted-foreground" />
          <CardTitle className="text-base">General</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Theme</p>
          <p className="font-mono text-sm" data-testid="settings-general-theme">{theme}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Sprache</p>
          <p className="font-mono text-sm" data-testid="settings-general-language">{language}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function NotificationsCard({ notifications }: { notifications: LokyySettings['notifications'] }) {
  const desktop = notifications?.desktop ?? false
  const sounds = notifications?.sounds ?? false
  return (
    <Card data-testid="settings-notifications">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BellIcon className="size-5 text-muted-foreground" />
          <CardTitle className="text-base">Notifications</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Desktop-Benachrichtigungen</p>
            <p className="text-xs text-muted-foreground">Native Browser-Notifications.</p>
          </div>
          <span
            className="font-mono text-xs text-muted-foreground"
            data-testid="settings-notifications-desktop"
          >
            {desktop ? 'on' : 'off'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Sounds</p>
            <p className="text-xs text-muted-foreground">Audio-Hinweise bei neuen Ereignissen.</p>
          </div>
          <span
            className="font-mono text-xs text-muted-foreground"
            data-testid="settings-notifications-sounds"
          >
            {sounds ? 'on' : 'off'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function HermesConfigCard({
  hermes,
  hermesLive,
  hermesError,
}: {
  hermes: Record<string, unknown> | null
  hermesLive: boolean
  hermesError?: string
}) {
  // Hermes /api/config returns this shape (Phase-2c):
  //   { model: string, providers: Record<string,...>, toolsets: string[],
  //     fallback_providers: string[], agent: {...}, ... }
  // Anything missing/empty falls back to a placeholder so the section still
  // renders — the bug we're fixing is "no render at all", so the cells just
  // need to be present even when hermes-config has empty strings.
  const modelRaw = hermes && typeof (hermes as { model?: unknown }).model === 'string'
    ? ((hermes as { model: string }).model)
    : ''
  const model = modelRaw && modelRaw.trim().length > 0 ? modelRaw : '(default)'

  const providersObj = hermes && hermes.providers && typeof hermes.providers === 'object'
    ? (hermes.providers as Record<string, unknown>)
    : {}
  const providerCount = Object.keys(providersObj).length

  const toolsets = hermes && Array.isArray((hermes as { toolsets?: unknown[] }).toolsets)
    ? ((hermes as { toolsets: unknown[] }).toolsets)
    : []

  // Generic "profiles count" — uses toolsets as the closest analogue to the
  // Phase-2c spec's "profiles count" (the dashboard /api/profiles list).
  const profilesCount = toolsets.length

  return (
    <Card data-testid="settings-hermes">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ServerIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Hermes-Config</CardTitle>
          </div>
          <span
            className={
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ' +
              (hermesLive
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-muted text-muted-foreground')
            }
            data-testid="settings-hermes-indicator"
            data-live={hermesLive ? 'true' : 'false'}
          >
            <CircleIcon
              className={'size-2 ' + (hermesLive ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground text-muted-foreground')}
            />
            {hermesLive ? 'live' : 'offline'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hermesLive ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Model</p>
              <p className="font-mono text-sm" data-testid="settings-hermes-model">{model}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Providers</p>
              <p className="font-mono text-sm" data-testid="settings-hermes-providers">{providerCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Profiles</p>
              <p className="font-mono text-sm" data-testid="settings-hermes-profiles">{profilesCount}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="settings-hermes-offline">
            Hermes-Backend nicht erreichbar
            {hermesError ? <span className="ml-1 text-xs">({hermesError})</span> : null}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function HermesAdminCard() {
  const [doctorOut, setDoctorOut] = useState<string | null>(null)
  const [backupOut, setBackupOut] = useState<string | null>(null)
  const [curatorOut, setCuratorOut] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function runDoctor() {
    setBusy('doctor')
    try {
      const d = await fetchDoctor()
      setDoctorOut(d.raw)
    } finally {
      setBusy(null)
    }
  }
  async function runBackup() {
    setBusy('backup')
    try {
      const b = await fetchBackup()
      setBackupOut(b.output + (b.path ? `\n\nZIP: ${b.path}` : ''))
    } finally {
      setBusy(null)
    }
  }
  async function runCurator() {
    setBusy('curator')
    try {
      const c = await fetchCurator()
      setCuratorOut(c.raw)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card data-testid="settings-hermes-admin">
      <CardHeader>
        <div className="flex items-center gap-2">
          <StethoscopeIcon className="size-5 text-muted-foreground" />
          <CardTitle className="text-base">Hermes Admin</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Button onClick={runDoctor} disabled={busy !== null} variant="outline" data-testid="admin-doctor">
            <StethoscopeIcon className="size-4" /> System-Check
          </Button>
          <Button onClick={runBackup} disabled={busy !== null} variant="outline" data-testid="admin-backup">
            <DownloadIcon className="size-4" /> Backup
          </Button>
          <Button onClick={runCurator} disabled={busy !== null} variant="outline" data-testid="admin-curator">
            <SparklesIcon className="size-4" /> Curator-Status
          </Button>
        </div>
        {doctorOut ? <OutputBlock label="Doctor" content={doctorOut} /> : null}
        {backupOut ? <OutputBlock label="Backup" content={backupOut} /> : null}
        {curatorOut ? <OutputBlock label="Curator" content={curatorOut} /> : null}
      </CardContent>
    </Card>
  )
}

function OutputBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs">{content}</pre>
    </div>
  )
}

function PathInput({
  initial,
  placeholder,
  onSave,
  testid,
}: {
  initial: string
  placeholder: string
  onSave: (v: string) => void
  testid: string
}) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={testid}
      />
      <Button onClick={() => onSave(value.trim())} data-testid={`${testid}-save`}>
        <SaveIcon className="size-4" /> Speichern
      </Button>
    </div>
  )
}
