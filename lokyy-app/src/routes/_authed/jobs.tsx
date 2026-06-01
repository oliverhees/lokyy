import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  BrainIcon,
  CalendarIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  ZapIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  listJobs,
  createJob,
  patchJob,
  deleteJob,
  runJob,
  presetToSchedule,
  scheduleToPreset,
  formatRelative,
  isBrainEnabled,
  BRAIN_TYPES,
  DEFAULT_BRAIN_TYPE,
  WEEKDAYS,
  type Job,
  type BrainType,
  type PresetFrequency,
} from '@/lib/lokyy-jobs'

export const Route = createFileRoute('/_authed/jobs')({
  component: JobsPage,
})

function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  // jobId -> letzter Lauf-Output (read-only, aus der /run Antwort)
  const [outputs, setOutputs] = useState<Record<string, string>>({})

  async function refresh() {
    try {
      setJobs(await listJobs())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(job: Job) {
    setEditing(job)
    setDialogOpen(true)
  }

  async function onSubmit(input: {
    name?: string
    schedule: string
    prompt: string
    brainEnabled: boolean
    brainType: BrainType | null
    brainFolderHint?: string | null
  }) {
    setError(null)
    try {
      if (editing) {
        await patchJob(editing.id, {
          name: input.name,
          schedule: input.schedule,
          prompt: input.prompt,
          brainEnabled: input.brainEnabled,
          brainType: input.brainEnabled ? input.brainType : null,
          brainFolderHint: input.brainEnabled ? (input.brainFolderHint ?? null) : null,
        })
      } else {
        await createJob(input)
      }
      setDialogOpen(false)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onDelete(id: string) {
    if (!confirm(`Job '${id}' löschen?`)) return
    setError(null)
    try {
      await deleteJob(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    await refresh()
  }

  async function onToggleStatus(id: string, current: 'active' | 'paused' | 'unknown') {
    const next = current === 'active' ? 'paused' : 'active'
    setError(null)
    try {
      await patchJob(id, { status: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    await refresh()
  }

  async function onRunNow(id: string) {
    setError(null)
    setRunningId(id)
    try {
      const res = await runJob(id)
      if (!res.ok) {
        setError(res.error ?? 'Run failed')
      } else if (res.hermesSkipped) {
        setError('Run ok — aber HERMES_API_KEY ist nicht gesetzt, Hermes-Call wurde übersprungen.')
      }
      if (res.hermesContent) {
        setOutputs((prev) => ({ ...prev, [id]: res.hermesContent! }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunningId(null)
      await refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Schedule Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Wiederkehrende Hermes-Aufgaben. Schedule per Preset (täglich / wöchentlich / stündlich)
            oder als rohe Cron-Expression. Optional landet der Output als Notiz im Brain.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="jobs-add">
          <PlusIcon className="size-4" /> Neuer Job
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <pre className="whitespace-pre-wrap text-xs text-destructive" role="alert">{error}</pre>
          </CardContent>
        </Card>
      ) : null}

      {jobs === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade Jobs…</p>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium" data-testid="jobs-empty">Noch keine Schedule-Jobs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klick „Neuer Job" um einen wiederkehrenden Hermes-Lauf anzulegen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{jobs.length} Job{jobs.length === 1 ? '' : 's'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60" data-testid="jobs-list">
              {jobs.map((j) => {
                const brainOn = isBrainEnabled(j)
                const out = outputs[j.id]
                return (
                  <li key={j.id} className="flex flex-col gap-2 px-6 py-3" data-testid={`job-row-${j.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                        <CalendarIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{j.name}</span>
                          <Badge variant={j.status === 'active' ? 'default' : 'secondary'} className="text-xs">{j.status}</Badge>
                          {brainOn ? (
                            <Badge variant="outline" className="text-xs" data-testid={`job-brain-${j.id}`} title={`In Brain als '${j.brainType}'`}>
                              <BrainIcon className="mr-1 size-3" />
                              {j.brainType ?? 'brain'}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          <code>{j.schedule}</code> · {j.command}
                        </p>
                        {j.lastRun ? (
                          <p className="text-xs text-muted-foreground" data-testid={`job-lastrun-${j.id}`}>
                            zuletzt: {formatRelative(j.lastRun) ?? j.lastRun}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRunNow(j.id)}
                        disabled={runningId === j.id}
                        title="Jetzt ausführen"
                        data-testid={`job-runnow-${j.id}`}
                      >
                        <ZapIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(j)}
                        title="Bearbeiten"
                        data-testid={`job-edit-${j.id}`}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleStatus(j.id, j.status)}
                        title={j.status === 'active' ? 'Pause' : 'Resume'}
                        data-testid={`job-toggle-${j.id}`}
                      >
                        {j.status === 'active' ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(j.id)} data-testid={`job-delete-${j.id}`}>
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                    {out ? (
                      <div className="ml-13 rounded-md border border-border/60 bg-muted/30 p-3" data-testid={`job-output-${j.id}`}>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Letzter Output</p>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{out}</pre>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <JobDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditing(null)
        }}
        editing={editing}
        onSubmit={onSubmit}
      />
    </div>
  )
}

function JobDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Job | null
  onSubmit: (input: {
    name?: string
    schedule: string
    prompt: string
    brainEnabled: boolean
    brainType: BrainType | null
    brainFolderHint?: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')

  // Schedule: Preset-Builder ODER rohe Cron-Eingabe (Fallback)
  const [useRawCron, setUseRawCron] = useState(false)
  const [rawSchedule, setRawSchedule] = useState('')
  const [frequency, setFrequency] = useState<PresetFrequency>('daily')
  const [time, setTime] = useState('09:00')
  const [weekday, setWeekday] = useState(1)

  // Brain-Felder
  const [brainEnabled, setBrainEnabled] = useState(false)
  const [brainType, setBrainType] = useState<BrainType>(DEFAULT_BRAIN_TYPE)
  const [brainFolderHint, setBrainFolderHint] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name === editing.command.slice(0, 40) ? '' : editing.name)
      setPrompt(editing.command)
      const preset = scheduleToPreset(editing.schedule)
      if (preset) {
        setUseRawCron(false)
        setFrequency(preset.frequency)
        setTime(preset.time)
        setWeekday(preset.weekday)
        setRawSchedule(editing.schedule)
      } else {
        setUseRawCron(true)
        setRawSchedule(editing.schedule)
      }
      const enabled = isBrainEnabled(editing)
      setBrainEnabled(enabled)
      setBrainType((editing.brainType as BrainType) || DEFAULT_BRAIN_TYPE)
      setBrainFolderHint(editing.brainFolderHint ?? '')
    } else {
      setName('')
      setPrompt('')
      setUseRawCron(false)
      setRawSchedule('')
      setFrequency('daily')
      setTime('09:00')
      setWeekday(1)
      setBrainEnabled(false)
      setBrainType(DEFAULT_BRAIN_TYPE)
      setBrainFolderHint('')
    }
  }, [open, editing])

  function computedSchedule(): string {
    if (useRawCron) return rawSchedule.trim()
    return presetToSchedule({ frequency, time, weekday })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Job bearbeiten' : 'Neuer Schedule-Job'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit({
              name: name || undefined,
              schedule: computedSchedule(),
              prompt,
              brainEnabled,
              brainType: brainEnabled ? brainType : null,
              brainFolderHint: brainEnabled ? (brainFolderHint.trim() || null) : null,
            })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="job-name">Name (optional)</Label>
            <Input id="job-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="job-form-name" />
          </div>

          {/* Schedule — Preset-Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Schedule</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setUseRawCron((v) => !v)}
                data-testid="job-form-toggle-cron"
              >
                {useRawCron ? 'Preset benutzen' : 'Rohe Cron-Expression'}
              </Button>
            </div>

            {useRawCron ? (
              <Input
                id="job-schedule-raw"
                required
                placeholder="z.B. 1h, 30m, oder 0 9 * * *"
                value={rawSchedule}
                onChange={(e) => setRawSchedule(e.target.value)}
                data-testid="job-form-schedule"
              />
            ) : (
              <div className="space-y-3 rounded-md border border-border/60 p-3">
                <div className="space-y-2">
                  <Label htmlFor="job-frequency" className="text-xs text-muted-foreground">Häufigkeit</Label>
                  <select
                    id="job-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as PresetFrequency)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="job-form-frequency"
                  >
                    <option value="hourly">Stündlich</option>
                    <option value="daily">Täglich</option>
                    <option value="weekly">Wöchentlich</option>
                  </select>
                </div>

                {frequency === 'weekly' ? (
                  <div className="space-y-2">
                    <Label htmlFor="job-weekday" className="text-xs text-muted-foreground">Wochentag</Label>
                    <select
                      id="job-weekday"
                      value={weekday}
                      onChange={(e) => setWeekday(Number.parseInt(e.target.value, 10))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      data-testid="job-form-weekday"
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {frequency !== 'hourly' ? (
                  <div className="space-y-2">
                    <Label htmlFor="job-time" className="text-xs text-muted-foreground">Uhrzeit</Label>
                    <Input
                      id="job-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      data-testid="job-form-time"
                    />
                  </div>
                ) : null}

                <p className="font-mono text-xs text-muted-foreground" data-testid="job-form-schedule-preview">
                  → <code>{presetToSchedule({ frequency, time, weekday })}</code>
                </p>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="job-prompt">Prompt / Task-Instruction</Label>
            <Textarea
              id="job-prompt"
              required
              rows={4}
              placeholder="z.B. 'Fasse die letzten 24h E-Mails zusammen.'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              data-testid="job-form-prompt"
            />
          </div>

          {/* Brain-Felder */}
          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="job-brain-enabled" className="flex items-center gap-1.5">
                  <BrainIcon className="size-4" /> In Brain speichern
                </Label>
                <p className="text-xs text-muted-foreground">Lege den Lauf-Output als Notiz im Brain-Vault ab.</p>
              </div>
              <Switch
                id="job-brain-enabled"
                checked={brainEnabled}
                onCheckedChange={setBrainEnabled}
                data-testid="job-form-brain-enabled"
              />
            </div>

            {brainEnabled ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="job-brain-type" className="text-xs text-muted-foreground">Brain-Typ</Label>
                  <select
                    id="job-brain-type"
                    required
                    value={brainType}
                    onChange={(e) => setBrainType(e.target.value as BrainType)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="job-form-brain-type"
                  >
                    {BRAIN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-brain-folder" className="text-xs text-muted-foreground">Ordner (optional)</Label>
                  <Input
                    id="job-brain-folder"
                    placeholder="z.B. 30_captures/scheduler"
                    value={brainFolderHint}
                    onChange={(e) => setBrainFolderHint(e.target.value)}
                    data-testid="job-form-brain-folder"
                  />
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" data-testid="job-form-save">{editing ? 'Speichern' : 'Anlegen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
