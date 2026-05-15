import { useState } from 'react'
import { XIcon, CopyIcon, EyeIcon, FileCodeIcon, DownloadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type Artifact = {
  id: string
  language: string
  code: string
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
  const canPreview = artifact && /^(html|svg)$/.test(artifact.language)

  if (!artifact) return null

  return (
    <aside
      className="flex h-full w-[480px] shrink-0 flex-col border-l bg-background"
      data-testid="artifact-panel"
    >
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
