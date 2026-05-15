import { useEffect, useState } from 'react'
import { XIcon, CopyIcon, EyeIcon, FileCodeIcon, DownloadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type Artifact = {
  id: string
  language: string
  code: string
}

const WIDTH_KEY = 'lokyy-artifact-width'
const MIN_WIDTH = 320
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 480

function clampWidth(n: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
}

export function extractArtifacts(content: string): Artifact[] {
  const out: Artifact[] = []
  const re = /```(\w*)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(content)) !== null) {
    const language = (m[1] || 'text').toLowerCase()
    // Nur signifikante Artefakte: ≥3 Zeilen oder explizit html/svg/markdown
    const code = m[2]
    const lines = code.split('\n').length
    const significant = lines >= 3 || ['html', 'svg', 'jsx', 'tsx', 'markdown', 'md', 'json'].includes(language)
    if (!significant) continue
    out.push({ id: `artifact-${i++}`, language, code })
  }
  return out
}

export function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: Artifact | null
  onClose: () => void
}) {
  const [tab, setTab] = useState<'code' | 'preview'>('code')
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH
    const stored = Number(window.localStorage.getItem(WIDTH_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH
  })
  const canPreview = artifact && /^(html|svg)$/.test(artifact.language)

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(width))
    } catch {
      // localStorage might be blocked — width still works in-session
    }
  }, [width])

  function onResizeStart(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width
    function onMove(ev: MouseEvent) {
      // Drag-Handle ist am LINKEN Rand des rechten Panels → dragging links
      // (negativer deltaX) macht das Panel breiter.
      setWidth(clampWidth(startWidth - (ev.clientX - startX)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!artifact) return null

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l bg-background"
      style={{ width }}
      data-testid="artifact-panel"
    >
      <div
        onMouseDown={onResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Artefakt-Panel-Breite anpassen"
        title="Ziehen, um das Panel zu verbreitern"
        className="group absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize bg-transparent hover:bg-primary/30 active:bg-primary/40"
        data-testid="artifact-resize-handle"
      />
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCodeIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">Artefakt</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{artifact.language}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigator.clipboard.writeText(artifact.code)}
            title="Kopieren"
            data-testid="artifact-copy"
          >
            <CopyIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              const blob = new Blob([artifact.code], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `artifact.${artifact.language === 'tsx' ? 'tsx' : artifact.language}`
              a.click()
              URL.revokeObjectURL(url)
            }}
            title="Download"
          >
            <DownloadIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} title="Schließen">
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {canPreview ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'code' | 'preview')} className="flex flex-1 flex-col">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="code">
              <FileCodeIcon className="mr-1 size-3.5" /> Code
            </TabsTrigger>
            <TabsTrigger value="preview">
              <EyeIcon className="mr-1 size-3.5" /> Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="flex-1 overflow-hidden">
            <CodeView code={artifact.code} />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <iframe
              srcDoc={artifact.code}
              title="Artifact preview"
              className="size-full border-0 bg-white"
              sandbox="allow-scripts"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeView code={artifact.code} />
        </div>
      )}
    </aside>
  )
}

function CodeView({ code }: { code: string }) {
  return (
    <pre className="h-full overflow-auto bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed">{code}</pre>
  )
}
