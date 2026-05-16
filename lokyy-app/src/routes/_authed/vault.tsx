import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BrainIcon, FolderIcon, FileTextIcon, ChevronRightIcon, ChevronDownIcon, HomeIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { listVault, readVault, type VaultEntry } from '@/lib/lokyy-vault'

export const Route = createFileRoute('/_authed/vault')({
  component: VaultPage,
})

function VaultPage() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [root, setRoot] = useState<string | null>(null)
  const [cwd, setCwd] = useState('')
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listVault('')
      .then((d) => {
        setConfigured(d.configured)
        setRoot(d.root)
        setEntries(d.entries)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  async function open(entry: VaultEntry) {
    setError(null)
    if (entry.type === 'dir') {
      const d = await listVault(entry.path)
      setEntries(d.entries)
      setCwd(entry.path)
      setSelected(null)
      setContent('')
    } else {
      const r = await readVault(entry.path)
      setContent(r.content)
      setSelected(entry.path)
    }
  }

  async function goHome() {
    const d = await listVault('')
    setEntries(d.entries)
    setCwd('')
    setSelected(null)
    setContent('')
  }

  async function goUp() {
    if (!cwd) return
    const parent = cwd.split('/').slice(0, -1).join('/')
    const d = await listVault(parent)
    setEntries(d.entries)
    setCwd(parent)
    setSelected(null)
    setContent('')
  }

  if (configured === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Second Brain</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">prüfe Vault-Konfiguration…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Second Brain</h1>
          <p className="text-sm text-muted-foreground">
            Read-only Obsidian-Vault-Anbindung. Lokyy zeigt dir Markdown-Notes ohne Schreibzugriff.
          </p>
        </div>
        <Card>
          <CardContent className="p-6 text-center" data-testid="vault-empty">
            <BrainIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Kein Obsidian-Vault konfiguriert</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Setze die Env-Variable{' '}
              <code className="rounded bg-muted px-1">LOKYY_VAULT_PATH=/pfad/zu/deinem/vault</code>{' '}
              und starte den Dev-Server neu. Settings-UI für Vault-Pfad kommt in einer späteren Phase.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Second Brain</h1>
        <p className="text-xs text-muted-foreground">
          Vault: <code className="rounded bg-muted px-1">{root}</code>
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="h-[calc(100vh-16rem)] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="truncate text-base" title={cwd || '/'}>
              {cwd ? cwd.split('/').pop() : 'Vault'}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={goHome} title="Zum Vault-Root">
                <HomeIcon className="size-4" />
              </Button>
              {cwd ? (
                <Button variant="ghost" size="icon" onClick={goUp} title="Eine Ebene hoch">
                  <ChevronDownIcon className="size-4 rotate-180" />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto p-0">
            <ul className="divide-y divide-border/60" data-testid="vault-entries">
              {entries.map((e) => (
                <li key={e.path}>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/40"
                    onClick={() => open(e)}
                    data-testid={`vault-entry-${e.type}-${e.name}`}
                  >
                    {e.type === 'dir' ? (
                      <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{e.name}</span>
                    {e.type === 'dir' ? <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" /> : null}
                  </button>
                </li>
              ))}
              {entries.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">leer</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="h-[calc(100vh-16rem)] overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="truncate text-base" title={selected ?? ''}>
              {selected ? selected.split('/').pop() : 'Wähle eine Note'}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto" data-testid="vault-content">
            {selected ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{content}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Klick eine .md-Datei links, um sie hier zu lesen.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
