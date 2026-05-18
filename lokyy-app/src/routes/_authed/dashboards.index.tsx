import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { LayoutDashboardIcon, PlusIcon, ClockIcon, CalendarIcon, MailIcon, ZapIcon, PlayIcon, SparklesIcon, SendIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { listDashboards, createDashboardFromIntent, dashboardChat, updateDashboard, type DashboardListItem, type ChatTurn } from '@/lib/lokyy-dashboards'

export const Route = createFileRoute('/_authed/dashboards/')({
  component: DashboardsListPage,
})

/** YYYY-MM-DD → relative ("heute" / "gestern" / "vor 3 Tagen") + DD.MM. for older. */
function formatRunDate(isoDate: string): string {
  const today = new Date().toISOString().slice(0, 10)
  if (isoDate === today) return 'heute'
  const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10)
  if (isoDate === yesterday) return 'gestern'
  const ageDays = Math.round((Date.parse(today) - Date.parse(isoDate)) / 86_400_000)
  if (ageDays > 0 && ageDays < 30) return `vor ${ageDays} Tagen`
  // For older runs, fall back to a readable date.
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

type Spec = { intent: string; schedule: string; title: string }

function DashboardsListPage() {
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [pendingSpec, setPendingSpec] = useState<Spec | null>(null)
  const [creating, setCreating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  function reload() {
    listDashboards()
      .then((list) => {
        // Defensive: backend already sorts createdAt-desc, but enforce it
        // client-side too so display order doesn't drift if state mutates.
        const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        setDashboards(sorted)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }
  useEffect(reload, [])

  function resetWizard() {
    setMessages([])
    setChatInput('')
    setPendingSpec(null)
    setChatBusy(false)
    setCreating(false)
  }

  async function sendChatTurn() {
    const text = chatInput.trim()
    if (text.length < 1 || chatBusy) return
    const next: ChatTurn[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setChatInput('')
    setChatBusy(true)
    try {
      const res = await dashboardChat(next)
      if (res.kind === 'message') {
        setMessages([...next, { role: 'assistant', content: res.content }])
      } else {
        // Got a structured spec — show confirmation card; don't append to chat.
        setPendingSpec(res.spec)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setChatBusy(false)
      // Scroll the chat pane to the latest message
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 50)
    }
  }

  async function confirmCreate() {
    if (!pendingSpec || creating) return
    setCreating(true)
    try {
      const result = await createDashboardFromIntent(pendingSpec.intent)
      // Apply schedule + title overrides if they differ from defaults
      await updateDashboard(result.dashboardId, {
        schedule: pendingSpec.schedule,
        title: pendingSpec.title,
      })
      setDialogOpen(false)
      resetWizard()
      navigate({ to: '/dashboards/$id', params: { id: result.dashboardId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="dashboards-page">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Dashboards</h1>
          <p className="text-sm text-muted-foreground">
            Selbstgebaute Dashboards — agentengetrieben, mit Historie. Chatte deinen Wunsch und Lokyy bastelt die View + den Producer-Skill.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetWizard() }}>
          <DialogTrigger asChild>
            <Button data-testid="dashboards-create">
              <PlusIcon className="size-4" />
              Neues Dashboard
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-primary" />
                Dashboard-Wizard
              </DialogTitle>
              <DialogDescription>
                Erzähl mir was du sehen willst. Lokyy stellt 1-2 Rückfragen und legt's dann an.
              </DialogDescription>
            </DialogHeader>

            <div
              ref={scrollRef}
              className="space-y-3 max-h-80 overflow-y-auto py-2"
              data-testid="dashboards-chat-messages"
            >
              {messages.length === 0 && !pendingSpec && (
                <div className="text-muted-foreground text-sm italic px-1">
                  Beispiel: «KI-News morgens um 8», oder «Tägliche Email-Zusammenfassung um 7 Uhr»
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    data-testid={`chat-msg-${m.role}`}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatBusy && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    Lokyy denkt nach…
                  </div>
                </div>
              )}
              {pendingSpec && (
                <Card data-testid="dashboards-spec-preview" className="border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wide">Bereit zum Erstellen</div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Titel</span>
                      <div className="font-medium">{pendingSpec.title}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Was zeigt das Dashboard?</span>
                      <div className="text-sm">«{pendingSpec.intent}»</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Schedule</span>
                      <div className="font-mono text-sm">{pendingSpec.schedule}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {!pendingSpec && (
              <div className="flex items-center gap-2">
                <Input
                  data-testid="dashboards-chat-input"
                  placeholder="Schreib deinen Wunsch…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendChatTurn()
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={sendChatTurn}
                  disabled={chatBusy || chatInput.trim().length === 0}
                  data-testid="dashboards-chat-send"
                >
                  <SendIcon className="size-4" />
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => { setDialogOpen(false); resetWizard() }} disabled={creating}>
                Abbrechen
              </Button>
              {pendingSpec ? (
                <>
                  <Button variant="outline" onClick={() => setPendingSpec(null)} disabled={creating}>
                    Anpassen
                  </Button>
                  <Button onClick={confirmCreate} disabled={creating} data-testid="dashboards-confirm-create">
                    {creating ? 'Wird erstellt…' : 'Erstellen'}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="border border-destructive/50 text-destructive rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {dashboards === null && !error ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : dashboards && dashboards.length === 0 ? (
        <Card data-testid="dashboards-empty">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutDashboardIcon className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">Noch kein Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Klick auf <em>Neues Dashboard</em> und beschreibe deinen Wunsch — Lokyy generiert die View und legt den Producer-Skill an.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="dashboards-grid">
          {dashboards?.map((d) => (
            <Link key={d.id} to="/dashboards/$id" params={{ id: d.id }}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full" data-testid={`dashboard-card-${d.id}`}>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {d.template === 'email-digest' ? <MailIcon className="size-5 text-emerald-500" /> : <ZapIcon className="size-5 text-primary" />}
                      <h3 className="font-semibold leading-tight">{d.title}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">{d.template}</Badge>
                  </div>
                  {d.originalIntent && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      «{d.originalIntent}»
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1" title="Hermes-Cron Schedule">
                      <ClockIcon className="size-3" />
                      <span className="font-mono">{d.schedule}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3" />
                      {d.runCount === 0 ? 'noch keine Runs' : `${d.runCount} Run${d.runCount > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <PlayIcon className="size-3" />
                    {d.lastRunDate
                      ? <span>Letzter Run: <span className="text-foreground">{formatRunDate(d.lastRunDate)}</span></span>
                      : <span className="italic">Noch nicht gelaufen</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
