import { useEffect, useMemo, useState } from 'react'
import { BrainCircuitIcon, BotIcon, CheckIcon, SearchIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createMyAgent, updateMyAgent, type LokyyAgent } from '@/lib/lokyy-my-agents'
import { listAgents as listHermesProfiles, type Agent as HermesProfile } from '@/lib/lokyy-agents'

type HermesSkill = { name: string; description: string; category: string; enabled: boolean }

export function LokyyAgentEditor({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When undefined → create mode; when set → edit mode. */
  initial?: LokyyAgent
  onSaved: (agent: LokyyAgent) => void
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('default')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [selectedMcps, setSelectedMcps] = useState<Set<string>>(new Set())
  const [skillFilter, setSkillFilter] = useState('')
  const [skills, setSkills] = useState<HermesSkill[]>([])
  const [profiles, setProfiles] = useState<HermesProfile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Load Hermes skills + profiles when dialog opens
  useEffect(() => {
    if (!open) return
    fetch('/api/lokyy/hermes-plugins', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d: { plugins?: HermesSkill[] }) => {
        // The hermes-plugins endpoint reuses the skill shape from earlier slices
        // — they have name/description/source ('source' = category).
        const mapped = (d.plugins ?? []).map((p) => ({
          name: p.name,
          description: p.description,
          category: (p as unknown as { source?: string }).source ?? 'other',
          enabled: (p as unknown as { status?: string }).status !== 'disabled',
        }))
        setSkills(mapped)
      })
      .catch(() => setSkills([]))

    listHermesProfiles().then(setProfiles).catch(() => setProfiles([]))
  }, [open])

  // Initialize form when dialog opens, either for create or edit
  useEffect(() => {
    if (!open) return
    if (initial) {
      setId(initial.id)
      setName(initial.name)
      setDescription(initial.description ?? '')
      setSystemPrompt(initial.systemPrompt)
      setModel(initial.model)
      setSelectedSkills(new Set(initial.skills))
      setSelectedMcps(new Set(initial.mcps))
    } else {
      setId('')
      setName('')
      setDescription('')
      setSystemPrompt('Du bist ein hilfreicher Assistent.')
      setModel('default')
      setSelectedSkills(new Set())
      setSelectedMcps(new Set())
    }
    setSkillFilter('')
    setError(null)
    setSaving(false)
  }, [open, initial])

  const filteredSkills = useMemo(() => {
    const q = skillFilter.toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    )
  }, [skills, skillFilter])

  function toggleSkill(name: string) {
    const next = new Set(selectedSkills)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelectedSkills(next)
  }

  function deriveId(): string {
    if (initial) return initial.id
    const slug = (id.trim() || name.trim())
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    return slug.slice(0, 64) || ''
  }

  async function save() {
    setError(null)
    const finalId = deriveId()
    if (!finalId) {
      setError('ID oder Name muss gesetzt sein')
      return
    }
    if (name.trim().length < 1) {
      setError('Name darf nicht leer sein')
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: finalId,
        name: name.trim(),
        description: description.trim() || undefined,
        systemPrompt,
        model: model.trim(),
        skills: [...selectedSkills],
        mcps: [...selectedMcps],
      }
      const result = initial
        ? await updateMyAgent(initial.id, payload)
        : await createMyAgent(payload)
      onSaved(result)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="lokyy-agent-editor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotIcon className="size-4 text-primary" />
            {initial ? `Agent bearbeiten: ${initial.name}` : 'Neuer Lokyy-Agent'}
          </DialogTitle>
          <DialogDescription>
            Custom Agent mit eigenem System-Prompt + curated Skills+MCPs. Skills werden als Verhaltens-Kontext in den System-Prompt injected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          {/* Linke Spalte: Stammdaten */}
          <div className="space-y-3">
            {!initial && (
              <div className="space-y-1">
                <Label htmlFor="agent-id">ID (slug, leer = aus Name ableiten)</Label>
                <Input
                  id="agent-id"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="news-curator"
                  data-testid="agent-id-input"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="News Curator"
                data-testid="agent-name-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-desc">Beschreibung (optional)</Label>
              <Input
                id="agent-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Filtert die wichtigsten KI-News"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-model">Model (Hermes-Profile)</Label>
              <select
                id="agent-model"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                data-testid="agent-model-select"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model})
                  </option>
                ))}
                {profiles.length === 0 && <option value="default">default</option>}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Das Hermes-Profile bestimmt welcher LLM-Provider und welches Modell antwortet.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-prompt">System-Prompt</Label>
              <textarea
                id="agent-prompt"
                className="w-full min-h-[140px] rounded-md border bg-background px-3 py-2 text-sm"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Du bist ein Assistent für…"
                data-testid="agent-prompt-textarea"
              />
              <p className="text-[10px] text-muted-foreground">
                Die ausgewählten Skill-Beschreibungen werden am Ende dieses Prompts injected.
              </p>
            </div>
          </div>

          {/* Rechte Spalte: Skills + MCPs */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <BrainCircuitIcon className="size-3.5" />
                  Skills
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  {selectedSkills.size} / {skills.length}
                </Badge>
              </div>
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Skills filtern…"
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                  data-testid="agent-skill-filter"
                />
              </div>
              <Card className="max-h-72 overflow-y-auto">
                <CardContent className="p-2 space-y-1">
                  {filteredSkills.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">
                      {skills.length === 0 ? 'lade…' : 'keine Treffer'}
                    </p>
                  ) : (
                    filteredSkills.map((s) => {
                      const checked = selectedSkills.has(s.name)
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => toggleSkill(s.name)}
                          className={`w-full flex items-start gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            checked ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-accent'
                          }`}
                          data-testid={`agent-skill-${s.name}`}
                        >
                          <div className={`size-4 rounded-sm border ${checked ? 'bg-primary border-primary' : 'border-input'} flex items-center justify-center shrink-0 mt-0.5`}>
                            {checked && <CheckIcon className="size-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs truncate">{s.name}</div>
                            {s.description && (
                              <div className="text-[10px] text-muted-foreground line-clamp-2">{s.description}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">{s.category}</Badge>
                        </button>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>MCPs</Label>
                <Badge variant="secondary" className="text-[10px]">v1: visual-only</Badge>
              </div>
              <Input
                placeholder="MCP-Namen kommagetrennt (Phase-5.x: real binding)"
                value={[...selectedMcps].join(', ')}
                onChange={(e) => {
                  const parts = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  setSelectedMcps(new Set(parts))
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                MCP-Binding wird real in der nächsten Slice — heute speichert Lokyy nur die Namen.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="border border-destructive/50 text-destructive rounded-md px-3 py-2 text-xs">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={saving} data-testid="agent-save">
            {saving ? 'Speichert…' : initial ? 'Speichern' : 'Anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
