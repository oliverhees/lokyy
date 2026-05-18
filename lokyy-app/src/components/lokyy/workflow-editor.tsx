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
  PenLineIcon,
  TrashIcon,
  LayoutDashboardIcon,
  ZapIcon,
  PackageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WorkflowSpec, NodeSpec, EdgeSpec } from '@/lib/lokyy-workflows'

// ─── Custom node renderer ──────────────────────────────────────────────────

type NodeData = { spec: NodeSpec }

const NODE_META: Record<
  string,
  { icon: typeof PlayIcon; color: string; label: string }
> = {
  'manual-trigger': { icon: PlayIcon, color: 'text-amber-500', label: 'Manual Trigger' },
  value: { icon: PackageIcon, color: 'text-cyan-500', label: 'Value' },
  'http-fetch': { icon: GlobeIcon, color: 'text-blue-500', label: 'HTTP Fetch' },
  'llm-call': { icon: MessageSquareIcon, color: 'text-primary', label: 'LLM Call' },
  'dashboard.save_data': { icon: LayoutDashboardIcon, color: 'text-emerald-500', label: 'Save to Dashboard' },
}

function WorkflowNode({ data }: NodeProps<Node<NodeData>>) {
  const spec = data.spec
  const meta = NODE_META[spec.type] ?? { icon: ZapIcon, color: 'text-muted-foreground', label: spec.type }
  const Icon = meta.icon
  return (
    <div className="rounded-md border bg-card shadow-sm min-w-[180px]" data-testid={`flow-node-${spec.id}`}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-primary" />
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Icon className={`size-4 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono truncate">{spec.id}</div>
          <div className="text-[10px] text-muted-foreground">{meta.label}</div>
        </div>
      </div>
      <div className="px-3 py-2 text-[10px] text-muted-foreground">
        {Object.keys(spec.config ?? {}).length === 0 ? (
          <span className="italic">no config</span>
        ) : (
          <span>{Object.keys(spec.config).length} cfg field(s)</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-primary" />
    </div>
  )
}

const nodeTypes = { workflowNode: WorkflowNode }

// ─── Editor ────────────────────────────────────────────────────────────────

export function WorkflowEditor({
  spec,
  onSave,
}: {
  spec: WorkflowSpec
  onSave: (next: WorkflowSpec) => Promise<void>
}) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner spec={spec} onSave={onSave} />
    </ReactFlowProvider>
  )
}

function WorkflowEditorInner({
  spec,
  onSave,
}: {
  spec: WorkflowSpec
  onSave: (next: WorkflowSpec) => Promise<void>
}) {
  // Convert spec → xyflow nodes/edges. Position defaults to a column if missing.
  const initialNodes: Node<NodeData>[] = useMemo(
    () =>
      spec.nodes.map((n, i) => ({
        id: n.id,
        type: 'workflowNode',
        position: n.position ?? { x: 100 + i * 240, y: 100 },
        data: { spec: n },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.id], // re-init when switching specs
  )
  const initialEdges: Edge[] = useMemo(
    () =>
      spec.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        animated: true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.id],
  )

  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ id: string; spec: NodeSpec } | null>(null)
  const { screenToFlowPosition } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const onNodesChange = useCallback((changes: NodeChange<Node<NodeData>>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
    setDirty(true)
  }, [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
    setDirty(true)
  }, [])
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
          animated: true,
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
    const center = screenToFlowPosition({
      x: (wrapperRef.current?.clientWidth ?? 600) / 2,
      y: (wrapperRef.current?.clientHeight ?? 400) / 2,
    })
    const newSpec: NodeSpec = {
      id,
      type,
      config: defaultConfigFor(type),
      position: center,
    }
    setNodes((nds) => [
      ...nds,
      { id, type: 'workflowNode', position: center, data: { spec: newSpec } },
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

  function openNodeEditor(nodeId: string) {
    const n = nodes.find((x) => x.id === nodeId)
    if (n) setEditing({ id: nodeId, spec: { ...n.data.spec, config: { ...(n.data.spec.config ?? {}) } } })
  }

  function applyNodeEdit() {
    if (!editing) return
    setNodes((nds) =>
      nds.map((n) => (n.id === editing.id ? { ...n, data: { spec: editing.spec } } : n)),
    )
    setDirty(true)
    setEditing(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ZapIcon className="size-4" />
          Editor — {nodes.length} Nodes, {edges.length} Verbindungen
        </CardTitle>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-500">● Ungespeichert</span>}
          <Button
            size="sm"
            variant="outline"
            onClick={deleteSelected}
            data-testid="editor-delete-selected"
            title="Selected node/edge löschen"
          >
            <TrashIcon className="size-3" />
            Löschen
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
            data-testid="editor-save"
          >
            <SaveIcon className="size-3" />
            {saving ? 'Speichert…' : 'Speichern'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Node palette */}
        <div className="flex items-center gap-1 px-3 py-2 border-y bg-muted/30 text-xs flex-wrap">
          <span className="text-muted-foreground mr-1">+ Node:</span>
          {Object.entries(NODE_META).map(([type, meta]) => {
            const Icon = meta.icon
            return (
              <Button
                key={type}
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => addNode(type)}
                data-testid={`palette-${type}`}
              >
                <Icon className={`size-3 ${meta.color}`} />
                {meta.label}
              </Button>
            )
          })}
        </div>
        <div
          ref={wrapperRef}
          className="relative w-full"
          style={{ height: '60vh' }}
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
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <div className="px-3 py-2 text-xs text-muted-foreground border-t">
          <strong>Tipp:</strong> Doppelklick auf einen Node öffnet den Config-Editor. Verbinden: vom rechten Punkt eines Nodes zum linken eines anderen ziehen.
        </div>
      </CardContent>

      {editing && (
        <Dialog open={true} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLineIcon className="size-4" />
                Node «{editing.id}» — {editing.spec.type}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="node-id">ID</Label>
                <Input
                  id="node-id"
                  value={editing.spec.id}
                  onChange={(e) =>
                    setEditing({ ...editing, spec: { ...editing.spec, id: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="node-config">Config (JSON)</Label>
                <textarea
                  id="node-config"
                  data-testid="node-config-textarea"
                  className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  value={JSON.stringify(editing.spec.config ?? {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value)
                      setEditing({ ...editing, spec: { ...editing.spec, config } })
                    } catch {
                      // ignore invalid JSON until save
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {configHelp(editing.spec.type)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
              <Button onClick={applyNodeEdit} data-testid="node-config-save">
                Übernehmen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
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
        userPrompt: 'Fasse zusammen: {{previousNodeId.field}}',
      }
    case 'dashboard.save_data':
      return { dashboardId: 'replace-with-id', payload: { items: [] } }
    default:
      return {}
  }
}

function configHelp(type: string): string {
  switch (type) {
    case 'value':
      return 'Static value. Beispiel: { "value": "hello" }'
    case 'http-fetch':
      return 'GET/POST. Felder: url, method, headers, body, jsonResponse (default true).'
    case 'llm-call':
      return 'Felder: userPrompt (required), systemPrompt, model, temperature. Placeholders: {{nodeId.field}} aus upstream outputs.'
    case 'dashboard.save_data':
      return 'Felder: dashboardId (string), payload (object). Wenn payload weggelassen + 1 upstream-node, dessen output wird benutzt.'
    case 'manual-trigger':
      return 'Keine Config. Output = der externalInput beim "Jetzt laufen".'
    default:
      return ''
  }
}
