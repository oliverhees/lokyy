import { SlashIcon } from 'lucide-react'

export type SlashCommand = {
  trigger: string
  label: string
  description: string
  handler: (arg: string) => void
}

export function SlashCommandsPopover({
  query,
  commands,
  onSelect,
}: {
  query: string
  commands: SlashCommand[]
  onSelect: (cmd: SlashCommand) => void
}) {
  if (!query.startsWith('/')) return null
  const search = query.slice(1).toLowerCase()
  const matches = commands.filter(
    (c) => c.trigger.toLowerCase().includes(search) || c.label.toLowerCase().includes(search),
  )
  if (matches.length === 0) return null

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
      data-testid="slash-popover"
    >
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        <SlashIcon className="mr-1 inline size-3" /> Slash-Commands
      </p>
      <ul className="space-y-0.5">
        {matches.map((c) => (
          <li key={c.trigger}>
            <button
              onClick={() => onSelect(c)}
              className="flex w-full items-start gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              data-testid={`slash-${c.trigger}`}
            >
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/{c.trigger}</code>
              <div className="min-w-0">
                <p className="font-medium">{c.label}</p>
                <p className="truncate text-xs text-muted-foreground">{c.description}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
