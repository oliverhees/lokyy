import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PlusIcon, UsersIcon, Trash2Icon, MessageSquareIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listTeams, createTeam, deleteTeam, type Team } from '@/lib/lokyy-teams'
import { listAgents, gradientForAgent, initialsFor, type Agent } from '@/lib/lokyy-agents'

export const Route = createFileRoute('/_authed/teams')({
  component: TeamsPage,
})

function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function refresh() {
    try {
      setTeams(await listTeams())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refresh()
    listAgents().then(setAgents).catch(() => {})
  }, [])

  async function onCreate(input: { name: string; description: string; memberAgentIds: string[] }) {
    try {
      await createTeam(input)
      setDialogOpen(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Team löschen?')) return
    await deleteTeam(id)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Stelle Agent-Teams zusammen für Multi-Agent-Aufgaben. Orchestrierung kommt in eigener Phase.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="teams-add">
          <PlusIcon className="size-4" /> Neues Team
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">{error}</p>
          </CardContent>
        </Card>
      ) : teams === null ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">lade…</p>
          </CardContent>
        </Card>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <UsersIcon className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium" data-testid="teams-empty">Noch keine Teams</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klick "Neues Team", um deinen ersten Multi-Agent-Mix anzulegen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="teams-grid">
          {teams.map((t) => (
            <Card key={t.id} data-testid={`team-card-${t.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Multi-Agent-Chat kommt später"
                      className="cursor-not-allowed"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MessageSquareIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(t.id)}
                      data-testid={`team-delete-${t.id}`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{t.memberAgentIds.length} Member</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.memberAgentIds.map((aid) => {
                    const agent = agents.find((a) => a.id === aid)
                    return (
                      <div
                        key={aid}
                        className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-2 py-1"
                      >
                        <div
                          className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: gradientForAgent(aid) }}
                          aria-hidden
                        >
                          {initialsFor(agent?.name ?? aid)}
                        </div>
                        <span className="text-xs">{agent?.name ?? aid}</span>
                      </div>
                    )
                  })}
                  {t.memberAgentIds.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">keine Member</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        onCreate={onCreate}
      />
    </div>
  )
}

function CreateTeamDialog({
  open,
  onOpenChange,
  agents,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agents: Agent[]
  onCreate: (input: { name: string; description: string; memberAgentIds: string[] }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setSelected(new Set())
    }
  }, [open])

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Team</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onCreate({ name, description, memberAgentIds: [...selected] })
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="team-form-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-desc">Beschreibung</Label>
            <Input id="team-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Member-Agents</Label>
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Agents verfügbar.</p>
            ) : (
              <ul className="space-y-1 rounded-md border border-border/60 p-2">
                {agents.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`member-${a.id}`}
                      checked={selected.has(a.id)}
                      onChange={() => toggleMember(a.id)}
                      data-testid={`team-member-${a.id}`}
                    />
                    <label htmlFor={`member-${a.id}`} className="flex items-center gap-2 text-sm">
                      <div
                        className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: gradientForAgent(a.id) }}
                        aria-hidden
                      >
                        {initialsFor(a.name)}
                      </div>
                      {a.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" data-testid="team-form-save">Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
