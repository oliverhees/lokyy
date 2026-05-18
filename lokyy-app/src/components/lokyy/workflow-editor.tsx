import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  PlayIcon,
  MessageSquareIcon,
  GlobeIcon,
  SaveIcon,
  TrashIcon,
  LayoutDashboardIcon,
  ZapIcon,
  PackageIcon,
  XIcon,
  CodeIcon,
  TerminalIcon,
  RouteIcon,
  CheckCircleIcon,
  XCircleIcon,
  SkipForwardIcon,
  BrainCircuitIcon,
} from 'lucide-react'
import { listAgents, type Agent } from '@/lib/lokyy-agents'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { WorkflowSpec, NodeSpec, EdgeSpec, WorkflowRunNodeResult } from '@/lib/lokyy-workflows'

// ─── Node-Type meta ────────────────────────────────────────────────────────

type NodeStatus = 'ok' | 'error' | 'skipped' | undefined

type NodeData = { spec: NodeSpec; lastStatus?: NodeStatus }

type NodeCategory = 'trigger' | 'data' | 'agent' | 'action'

const NODE_META: Record<
  string,
  {
    icon: typeof PlayIcon
    color: string  // tailwind border + bg accent
    label: string
    category: NodeCategory
    summary: (config: Record<string, unknown>) => string
  }
> = {
  'manual-trigger': {
    icon: PlayIcon,
    color: 'border-amber-500/40 bg-amber-500/10',
    label: 'Manual Trigger',
    category: 'trigger',
    summary: () => 'externalInput → Output',
  },
  value: {
    icon: PackageIcon,
    color: 'border-cyan-500/40 bg-cyan-500/10',
    label: 'Value',
    category: 'data',
    summary: (c) => {
      const v = c.value
      if (typeof v === 'string') return `"${v.slice(0, 30)}${v.length > 30 ? '…' : ''}"`
      if (v === undefined) return '(unset)'
      return JSON.stringify(v).slice(0, 40)
    },
  },
  'http-fetch': {
    icon: GlobeIcon,
    color: 'border-blue-500/40 bg-blue-500/10',
    label: 'HTTP Fetch',
    category: 'data',
    summary: (c) => {
      const url = typeof c.url === 'string' ? c.url.replace(/^https?:\/\//, '') : '?'
      const method = typeof c.method === 'string' ? c.method : 'GET'
      return `${method} ${url.slice(0, 40)}`
    },
  },
  'llm-call': {
    icon: MessageSquareIcon,
    color: 'border-primary/40 bg-primary/10',
    label: 'LLM Call',
    category: 'agent',
    summary: (c) => {
      const p = typeof c.userPrompt === 'string' ? c.userPrompt : ''
      return p.slice(0, 50) + (p.length > 50 ? '…' : '')
    },
  },
  'hermes-agent': {
    icon: BrainCircuitIcon,
    color: 'border-fuchsia-500/40 bg-fuchsia-500/10',
    label: 'Hermes Agent',
    category: 'agent',
    summary: (c) => {
      const profile = typeof c.profile === 'string' ? c.profile : '(profile?)'
      const p = typeof c.userPrompt === 'string' ? c.userPrompt : ''
      return `${profile} · ${p.slice(0, 40)}${p.length > 40 ? '…' : ''}`
    },
  },
  'dashboard.save_data': {
    icon: LayoutDashboardIcon,
    color: 'border-emerald-500/40 bg-emerald-500/10',
    label: 'Save to Dashboard',
    category: 'action',
    summary: (c) => `→ ${(c.dashboardId as string | undefined) ?? '(dashboardId?)'}`,
  },
}

const CATEGORY_META: Record<NodeCategory, { label: string; color: string }> = {
  trigger: { label: 'Trigger', color: 'text-amber-500' },
  data: { label: 'Data', color: 'text-blue-500' },
  agent: { label: 'AI / Agent', color: 'text-primary' },
  action: { label: 'Action', color: 'text-emerald-500' },
}

function StatusDot({ status }: { status: NodeStatus }) {
  if (!status) return null
  const Icon =
    status === 'ok' ? CheckCircleIcon : status === 'skipped' ? SkipForwardIcon : XCircleIcon
  const color =
    status === 'ok' ? 'text-emerald-500' : status === 'skipped' ? 'text-muted-foreground' : 'text-destructive'
  return <Icon className={`size-3.5 ${color}`} />
}

// ─── Custom node renderer ──────────────────────────────────────────────────

function WorkflowNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const spec = data.spec
  const meta = NODE_META[spec.type] ?? {
    icon: ZapIcon,
    color: 'border-muted-foreground/40 bg-muted/20',
    label: spec.type,
    category: 'data' as NodeCategory,
    summary: () => '',
  }
  const Icon = meta.icon
  const summary = meta.summary(spec.config ?? {})
  return (
    <div
      className={`rounded-lg border-2 ${meta.color} ${selected ? 'ring-2 ring-primary' : ''} bg-card min-w-[220px] shadow-md`}
      data-testid={`flow-node-${spec.id}`}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary !border-2 !border-card" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Icon className="size-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight truncate">{meta.label}</div>
          <div className="text-[10px] text-muted-foreground font-mono truncate">{spec.id}</div>
        </div>
        <StatusDot status={data.lastStatus} />
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground line-clamp-2 min-h-[1.6em]">
        {summary || <span className="italic opacity-60">no config</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary !border-2 !border-card" />
    </div>
  )
}

const nodeTypes = { workflowNode: WorkflowNode }

// ─── Editor ────────────────────────────────────────────────────────────────

export function WorkflowEditor({
  spec,
  lastRunNodes,
  onSave,
}: {
  spec: WorkflowSpec
  lastRunNodes?: WorkflowRunNodeResult[]
  onSave: (next: WorkflowSpec) => Promise<void>
}) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner spec={spec} lastRunNodes={lastRunNodes} onSave={onSave} />
    </ReactFlowProvider>
  )
}

function WorkflowEditorInner({
  spec,
  lastRunNodes,
  onSave,
}: {
  spec: WorkflowSpec
  lastRunNodes?: WorkflowRunNodeResult[]
  onSave: (next: WorkflowSpec) => Promise<void>
}) {
  const statusByNodeId = useMemo(() => {
    const m = new Map<string, NodeStatus>()
    for (const r of lastRunNodes ?? []) m.set(r.nodeId, r.status)
    return m
  }, [lastRunNodes])

  const initialNodes: Node<NodeData>[] = useMemo(
    () =>
      spec.nodes.map((n, i) => ({
        id: n.id,
        type: 'workflowNode',
        position: n.position ?? { x: 100 + i * 260, y: 120 },
        data: { spec: n, lastStatus: statusByNodeId.get(n.id) },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.id],
  )
  const initialEdges: Edge[] = useMemo(
    () =>
      spec.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        animated: true,
        style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.id],
  )

  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ id: string; spec: NodeSpec; configText: string; configError: string | null } | null>(null)
  const { screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Re-apply last-run statuses when they arrive after mount
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, lastStatus: statusByNodeId.get(n.id) },
      })),
    )
  }, [statusByNodeId])

  const onNodesChange = useCallback((changes: NodeChange<Node<NodeData>>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
    if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) setDirty(true)
  }, [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
    if (changes.some((c) => c.type !== 'select')) setDirty(true)
  }, [])
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
          animated: true,
          style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
        },
        eds,
      ),
    )
    setDirty(true)
  }, [])

  function addNode(type: string) {
    const baseId = type.replace(/[^a-z]/g, '').slice(0, 8) || 'node'
    let id = baseId
    let suffix = 1
    while (nodes.find((n) => n.id === id)) {
      id = `${baseId}${++suffix}`
    }
    // Smart placement: position relative to the rightmost existing node + 280px
    // (matches the node width + some gap). For the first node, use canvas center.
    let position: { x: number; y: number }
    if (nodes.length === 0) {
      position = screenToFlowPosition({
        x: (wrapperRef.current?.clientWidth ?? 600) / 2,
        y: (wrapperRef.current?.clientHeight ?? 400) / 2,
      })
    } else {
      // Find the rightmost node, place new one to its right at the same Y level
      const rightmost = nodes.reduce((acc, n) => (n.position.x > acc.position.x ? n : acc), nodes[0]!)
      position = { x: rightmost.position.x + 280, y: rightmost.position.y }
    }
    const newSpec: NodeSpec = {
      id,
      type,
      config: defaultConfigFor(type),
      position,
    }
    setNodes((nds) => [
      ...nds,
      { id, type: 'workflowNode', position, data: { spec: newSpec } },
    ])
    setDirty(true)
  }

  function deleteSelected() {
    setNodes((nds) => {
      const remaining = nds.filter((n) => !n.selected)
      if (remaining.length !== nds.length) {
        const removedIds = new Set(nds.filter((n) => n.selected).map((n) => n.id))
        setEdges((eds) => eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)))
        setDirty(true)
      }
      return remaining
    })
    setEdges((eds) => {
      const remaining = eds.filter((e) => !e.selected)
      if (remaining.length !== eds.length) setDirty(true)
      return remaining
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const nextNodes: NodeSpec[] = nodes.map((n) => ({
        ...n.data.spec,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      }))
      const nextEdges: EdgeSpec[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
      }))
      const next: WorkflowSpec = {
        ...spec,
        nodes: nextNodes,
        edges: nextEdges,
        updatedAt: new Date().toISOString(),
      }
      await onSave(next)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  // Auto-save 1.5s after the last change — so 'Jetzt laufen' never runs
  // on a stale spec.
  useEffect(() => {
    if (!dirty || saving) return
    const t = setTimeout(() => {
      void handleSave()
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, nodes, edges])

  function openNodeEditor(nodeId: string) {
    const n = nodes.find((x) => x.id === nodeId)
    if (!n) return
    setEditing({
      id: nodeId,
      spec: { ...n.data.spec, config: { ...(n.data.spec.config ?? {}) } },
      configText: JSON.stringify(n.data.spec.config ?? {}, null, 2),
      configError: null,
    })
  }

  function applyNodeEdit() {
    if (!editing) return
    let config: Record<string, unknown>
    try {
      config = JSON.parse(editing.configText)
    } catch (e) {
      setEditing({ ...editing, configError: (e as Error).message })
      return
    }
    const finalSpec: NodeSpec = { ...editing.spec, config }
    setNodes((nds) =>
      nds.map((n) => (n.id === editing.id ? { ...n, data: { ...n.data, spec: finalSpec } } : n)),
    )
    setDirty(true)
    setEditing(null)
  }

  // Variable picker: what upstream nodes feed the currently-edited node?
  const upstreamForEditing = useMemo(() => {
    if (!editing) return []
    const result: string[] = []
    for (const e of edges) {
      if (e.target === editing.id) result.push(e.source)
    }
    return result
  }, [editing, edges])

  function insertAtCursor(token: string) {
    if (!editing) return
    const ta = document.getElementById('node-config-textarea') as HTMLTextAreaElement | null
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = editing.configText.slice(0, start)
    const after = editing.configText.slice(end)
    const next = before + token + after
    setEditing({ ...editing, configText: next })
    // Restore cursor position right after inserted token
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + token.length
    }, 0)
  }

  // Group palette by category
  const paletteByCategory = useMemo(() => {
    const groups: Record<NodeCategory, Array<[string, (typeof NODE_META)[string]]>> = {
      trigger: [],
      data: [],
      agent: [],
      action: [],
    }
    for (const [type, m] of Object.entries(NODE_META)) {
      groups[m.category].push([type, m])
    }
    return groups
  }, [])

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ZapIcon className="size-4" />
          Editor — {nodes.length} Nodes · {edges.length} Verbindungen
        </CardTitle>
        <div className="flex items-center gap-2">
          {dirty && !saving && <span className="text-xs text-amber-500">● ungespeichert</span>}
          {saving && <span className="text-xs text-muted-foreground">speichert…</span>}
          {!dirty && !saving && <span className="text-xs text-emerald-500">✓ gespeichert</span>}
          <Button size="sm" variant="outline" onClick={deleteSelected} data-testid="editor-delete-selected">
            <TrashIcon className="size-3" />
            Löschen
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving} data-testid="editor-save">
            <SaveIcon className="size-3" />
            {saving ? 'Speichert…' : 'Speichern'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Grouped node palette */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-y bg-muted/30 text-xs">
          {(Object.keys(paletteByCategory) as NodeCategory[]).map((cat) => (
            <div key={cat} className="flex items-center gap-1">
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${CATEGORY_META[cat].color} mr-1`}>
                {CATEGORY_META[cat].label}
              </span>
              {paletteByCategory[cat].map(([type, meta]) => {
                const Icon = meta.icon
                return (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 gap-1.5"
                    onClick={() => addNode(type)}
                    data-testid={`palette-${type}`}
                  >
                    <Icon className="size-3" />
                    <span className="text-xs">{meta.label}</span>
                  </Button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div
          ref={wrapperRef}
          className="relative w-full"
          style={{ height: '62vh' }}
          data-testid="workflow-editor-canvas"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={(_e, n) => openNodeEditor(n.id)}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
            }}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>

          {/* Side-panel — overlays the right side of the canvas while editing */}
          {editing && (
            <aside
              className="absolute top-0 right-0 bottom-0 w-[420px] bg-card border-l shadow-2xl flex flex-col z-10"
              data-testid="node-side-panel"
            >
              <NodePanel
                editing={editing}
                upstream={upstreamForEditing}
                allNodeIds={nodes.map((n) => n.data.spec.id)}
                onChange={(next) => setEditing(next)}
                onInsertToken={insertAtCursor}
                onClose={() => setEditing(null)}
                onApply={applyNodeEdit}
              />
            </aside>
          )}
        </div>
        <div className="px-3 py-2 text-xs text-muted-foreground border-t flex items-center justify-between">
          <span><strong>Tipp:</strong> Doppelklick öffnet das Config-Panel. Verbinden: rechter Punkt → linker Punkt.</span>
          <span className="text-[10px] opacity-60">Auto-Save 1.5s nach jeder Änderung</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Side panel for node config ────────────────────────────────────────────

type EditingState = { id: string; spec: NodeSpec; configText: string; configError: string | null }

function NodePanel({
  editing,
  upstream,
  allNodeIds,
  onChange,
  onInsertToken,
  onClose,
  onApply,
}: {
  editing: EditingState
  upstream: string[]
  allNodeIds: string[]
  onChange: (next: EditingState) => void
  onInsertToken: (token: string) => void
  onClose: () => void
  onApply: () => void
}) {
  const meta = NODE_META[editing.spec.type] ?? null
  const Icon = meta?.icon ?? CodeIcon
  const supportsTemplates =
    editing.spec.type === 'llm-call' ||
    editing.spec.type === 'hermes-agent' ||
    editing.spec.type === 'dashboard.save_data'
  const isHermesAgent = editing.spec.type === 'hermes-agent'

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{meta?.label ?? editing.spec.type}</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">id: {editing.spec.id}</div>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="node-panel-close">
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="node-id">Node-ID</Label>
          <Input
            id="node-id"
            value={editing.spec.id}
            onChange={(e) =>
              onChange({ ...editing, spec: { ...editing.spec, id: e.target.value } })
            }
          />
          <p className="text-[10px] text-muted-foreground">
            ID wird als Variable-Name benutzt: <code className="font-mono">{`{{${editing.spec.id}}}`}</code>
          </p>
        </div>

        {isHermesAgent && <HermesAgentPicker editing={editing} onChange={onChange} />}

        {supportsTemplates && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs">
              <TerminalIcon className="size-3" />
              <span className="font-semibold">Verfügbare Variablen</span>
              <Badge variant="secondary" className="text-[10px]">click to insert</Badge>
            </div>
            {upstream.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                Verbinde diesen Node mit einem upstream-Node, dann kannst du dessen Output mit{' '}
                <code className="font-mono">{`{{nodeId}}`}</code> einsetzen.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {upstream.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onInsertToken(`{{${id}}}`)}
                    className="px-2 py-0.5 rounded font-mono text-[10px] border bg-card hover:bg-accent hover:border-primary/40 transition-colors"
                    data-testid={`var-pick-${id}`}
                  >
                    {`{{${id}}}`}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Tiefer: <code className="font-mono">{`{{nodeId.feld.subfeld}}`}</code>
            </p>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="node-config-textarea">Config (JSON)</Label>
            {editing.configError && (
              <span className="text-[10px] text-destructive">JSON: {editing.configError.slice(0, 60)}</span>
            )}
          </div>
          <textarea
            id="node-config-textarea"
            data-testid="node-config-textarea"
            className="w-full min-h-[260px] rounded-md border bg-background px-3 py-2 text-xs font-mono"
            value={editing.configText}
            spellCheck={false}
            onChange={(e) => onChange({ ...editing, configText: e.target.value, configError: null })}
          />
          <p className="text-[10px] text-muted-foreground">{configHelp(editing.spec.type)}</p>
        </div>
      </div>

      <div className="border-t px-4 py-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={onApply} data-testid="node-config-save">
          Übernehmen
        </Button>
      </div>
    </>
  )
}

// Avoid unused-import warnings — these icons are reserved for future panel
// elements (route/branch nodes, etc.).
const _reservedIcons = { RouteIcon }
void _reservedIcons

// ─── Hermes Agent Picker ───────────────────────────────────────────────────

function HermesAgentPicker({
  editing,
  onChange,
}: {
  editing: EditingState
  onChange: (next: EditingState) => void
}) {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : String(e))
        setAgents([])
      })
  }, [])

  // Read currently-selected profile out of the JSON config-text.
  const currentProfile = (() => {
    try {
      const c = JSON.parse(editing.configText) as { profile?: string }
      return typeof c.profile === 'string' ? c.profile : ''
    } catch {
      return ''
    }
  })()

  const selected = agents?.find((a) => a.id === currentProfile) ?? null

  function setProfile(profile: string) {
    let c: Record<string, unknown> = {}
    try {
      c = JSON.parse(editing.configText)
    } catch {
      // keep defaults
    }
    c.profile = profile
    onChange({
      ...editing,
      configText: JSON.stringify(c, null, 2),
      configError: null,
    })
  }

  return (
    <div className="rounded-md border bg-fuchsia-500/5 border-fuchsia-500/30 p-3 space-y-2" data-testid="hermes-agent-picker">
      <div className="flex items-center gap-1.5 text-xs">
        <BrainCircuitIcon className="size-3 text-fuchsia-500" />
        <span className="font-semibold">Hermes Agent (Profil)</span>
      </div>

      {loadError && (
        <p className="text-[10px] text-destructive">Fehler beim Laden der Profile: {loadError}</p>
      )}

      {agents === null ? (
        <p className="text-[10px] text-muted-foreground italic">lade Profile…</p>
      ) : agents.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">
          Keine Hermes-Profile gefunden. Konfiguriere mindestens einen Provider in Hermes.
        </p>
      ) : (
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs font-mono"
          value={currentProfile}
          onChange={(e) => setProfile(e.target.value)}
          data-testid="hermes-agent-profile-select"
        >
          <option value="">— Profil wählen —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.model})
            </option>
          ))}
        </select>
      )}

      {selected && (
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div>
            <span className="opacity-60">Model:</span>{' '}
            <code className="font-mono">{selected.model}</code>
          </div>
          <div>
            <span className="opacity-60">Provider:</span> {selected.provider}{' '}
            <span className="opacity-60 ml-2">·</span> {selected.skillCount} Skills · {selected.mcpCount} MCPs
            {selected.hasSoul && <span className="ml-2">· Soul</span>}
          </div>
          {selected.description && (
            <div className="opacity-60 italic line-clamp-2 pt-0.5">{selected.description}</div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground pt-1">
        Der Agent läuft mit allen Skills + MCPs aus diesem Profil. Output kommt im{' '}
        <code className="font-mono">content</code>-Feld.
      </p>
    </div>
  )
}

function defaultConfigFor(type: string): Record<string, unknown> {
  switch (type) {
    case 'value':
      return { value: 'hello' }
    case 'http-fetch':
      return { url: 'https://hacker-news.firebaseio.com/v0/maxitem.json', method: 'GET' }
    case 'llm-call':
      return {
        systemPrompt: 'Du bist ein hilfreicher Assistent.',
        userPrompt: 'Schreib einen kurzen Witz.',
      }
    case 'hermes-agent':
      return {
        profile: 'default',
        systemPrompt: '',
        userPrompt: 'Beantworte: {{previousNode}}',
      }
    case 'dashboard.save_data':
      return { dashboardId: 'replace-with-dashboard-id', payload: { items: [] } }
    default:
      return {}
  }
}

function configHelp(type: string): string {
  switch (type) {
    case 'value':
      return 'Static value. Beispiel: { "value": "hello" } oder beliebiges Object.'
    case 'http-fetch':
      return 'Felder: url (required), method, headers, body, jsonResponse (default true).'
    case 'llm-call':
      return 'Felder: userPrompt (required), systemPrompt, model, temperature. Variablen siehe oben.'
    case 'hermes-agent':
      return 'Felder: profile (required — Hermes-Profilname), userPrompt (required), systemPrompt, temperature. Output enthält content + profile + raw Response.'
    case 'dashboard.save_data':
      return 'Felder: dashboardId (required), payload (object oder Variable). Wenn payload weggelassen + 1 upstream-node, dessen output wird verwendet.'
    case 'manual-trigger':
      return 'Keine Config. Output = der externalInput beim "Jetzt laufen".'
    default:
      return ''
  }
}
