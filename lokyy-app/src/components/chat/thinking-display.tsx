import { useState } from 'react'
import { BrainIcon, ChevronRightIcon } from 'lucide-react'

export function extractThinking(content: string): { thinking: string | null; cleanContent: string } {
  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>\s*/i)
  if (!match) return { thinking: null, cleanContent: content }
  return {
    thinking: match[1].trim(),
    cleanContent: content.replace(match[0], '').trim(),
  }
}

export function ThinkingDisplay({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-muted/30" data-testid="thinking-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <BrainIcon className="size-3.5 shrink-0" />
        <ChevronRightIcon className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span>Thinking</span>
        <span className="ml-auto text-[10px]">{thinking.length} chars</span>
      </button>
      {open ? (
        <pre className="border-t border-border/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {thinking}
        </pre>
      ) : null}
    </div>
  )
}
