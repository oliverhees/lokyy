import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BrainIcon, CheckCircle2Icon, KeyIcon, HardDriveIcon, SparklesIcon, UserIcon, SaveIcon, Loader2Icon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fetchMemory, type MemoryStatus } from '@/lib/lokyy-hermes'
import { fetchPersona, savePersona, fetchUserFacts, saveUserFacts, type EditableFile } from '@/lib/lokyy-persona'

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
          Was Lokyys Agent über dich weiß und wie er sich verhält. Änderungen wirken sofort beim nächsten Chat — kein Neustart nötig.
        </p>
      </div>

      <EditableFileCard
        title="Agent-Persona (SOUL.md)"
        description="Wer Lokyy ist, wie er kommuniziert, was er kann/nicht-kann. Wird bei jeder Message frisch geladen."
        icon={<SparklesIcon className="size-5 text-muted-foreground" />}
        fetcher={fetchPersona}
        saver={savePersona}
        testid="memory-persona"
      />

      <EditableFileCard
        title="Über dich (USER.md)"
        description="Stabile Fakten: Name, Anrede, Sprache, bevorzugter Notification-Channel. Lokyy liest das automatisch."
        icon={<UserIcon className="size-5 text-muted-foreground" />}
        fetcher={fetchUserFacts}
        saver={saveUserFacts}
        testid="memory-user-facts"
      />

      {error ? <Card><CardContent className="p-6"><p className="text-sm text-destructive">{error}</p></CardContent></Card> :
       !status ? <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">lade Provider-Status…</p></CardContent></Card> :
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

function EditableFileCard({
  title,
  description,
  icon,
  fetcher,
  saver,
  testid,
}: {
  title: string
  description: string
  icon: React.ReactNode
  fetcher: () => Promise<EditableFile>
  saver: (content: string) => Promise<void>
  testid: string
}) {
  const [file, setFile] = useState<EditableFile | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    fetcher()
      .then((f) => {
        setFile(f)
        setDraft(f.content)
      })
      .catch((e) => setError(String(e)))
  }, [fetcher])

  async function onSave() {
    setBusy(true)
    setError(null)
    try {
      await saver(draft)
      setSavedAt(Date.now())
      setFile((prev) => (prev ? { ...prev, content: draft } : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const dirty = file !== null && draft !== file.content
  const justSaved = savedAt !== null && Date.now() - savedAt < 3000

  return (
    <Card data-testid={testid}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <div className="flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          {file?.path ? <code className="text-xs text-muted-foreground">{file.path}</code> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {file === null ? (
          <p className="text-sm text-muted-foreground">lade…</p>
        ) : (
          <>
            <Textarea
              rows={Math.min(20, Math.max(8, draft.split('\n').length + 1))}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="font-mono text-xs"
              data-testid={`${testid}-textarea`}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {dirty ? 'Ungespeicherte Änderungen' : justSaved ? 'Gespeichert ✓' : 'Live im nächsten Chat.'}
              </p>
              <Button onClick={onSave} disabled={busy || !dirty} size="sm" data-testid={`${testid}-save`}>
                {busy ? <Loader2Icon className="mr-1 size-3 animate-spin" /> : <SaveIcon className="mr-1 size-3" />}
                Speichern
              </Button>
            </div>
            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
