import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PlusIcon, SearchIcon, CopyIcon, Trash2Icon, PencilIcon, StickyNoteIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  type Prompt,
} from '@/lib/lokyy-prompts'

export const Route = createFileRoute('/_authed/prompts')({
  component: PromptsPage,
})

function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function refresh() {
    try {
      setPrompts(await listPrompts())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    if (!prompts) return []
    const q = query.trim().toLowerCase()
    if (!q) return prompts
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [prompts, query])

  async function onSave(input: { title: string; body: string; tags: string[] }) {
    try {
      if (editing) {
        await updatePrompt(editing.id, input)
      } else {
        await createPrompt(input)
      }
      setDialogOpen(false)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Prompt löschen?')) return
    try {
      await deletePrompt(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onCopy(body: string) {
    await navigator.clipboard.writeText(body)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Prompt Library</h1>
          <p className="text-sm text-muted-foreground">
            Speichere wiederverwendbare Prompts mit Tags und kopiere sie in einem Klick.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          data-testid="prompts-add"
        >
          <PlusIcon className="size-4" />
          Neuer Prompt
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Suche in Titel, Body, Tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
          data-testid="prompts-search"
        />
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : prompts === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade Prompts…</p>
          </CardContent>
        </Card>
      ) : prompts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <StickyNoteIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium" data-testid="prompts-empty">Noch keine Prompts</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klick „Neuer Prompt", um deinen ersten Template anzulegen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="prompts-grid">
          {filtered.map((p) => (
            <Card key={p.id} className="flex h-full flex-col" data-testid={`prompt-card-${p.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onCopy(p.body)}
                      title="Body kopieren"
                      data-testid={`prompt-copy-${p.id}`}
                    >
                      <CopyIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(p)
                        setDialogOpen(true)
                      }}
                      title="Editieren"
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(p.id)}
                      title="Löschen"
                      data-testid={`prompt-delete-${p.id}`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{p.body}</p>
                {p.tags.length > 0 ? (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PromptDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditing(null)
        }}
        initial={editing}
        onSave={onSave}
      />
    </div>
  )
}

function PromptDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: Prompt | null
  onSave: (input: { title: string; body: string; tags: string[] }) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsText, setTagsText] = useState('')

  useEffect(() => {
    setTitle(initial?.title ?? '')
    setBody(initial?.body ?? '')
    setTagsText(initial?.tags.join(', ') ?? '')
  }, [initial, open])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    onSave({ title, body, tags })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Prompt editieren' : 'Neuer Prompt'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt-title">Titel</Label>
            <Input
              id="prompt-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="prompt-form-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-body">Body</Label>
            <Textarea
              id="prompt-body"
              required
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="prompt-form-body"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-tags">Tags (Komma-getrennt)</Label>
            <Input
              id="prompt-tags"
              placeholder="coding, review, lokyy"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              data-testid="prompt-form-tags"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" data-testid="prompt-form-save">
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
