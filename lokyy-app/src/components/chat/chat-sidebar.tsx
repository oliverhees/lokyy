import { useState } from 'react'
import { PlusIcon, MessageSquareIcon, Trash2Icon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { groupByDate, type Conversation } from '@/lib/lokyy-conversations'

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = conversations.filter(
    (c) => !query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const groups = groupByDate(filtered)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-background/40" data-testid="chat-sidebar">
      <div className="space-y-3 border-b p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" data-testid="chat-new">
          <PlusIcon className="size-4" /> Neuer Chat
        </Button>
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="History durchsuchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
            data-testid="chat-history-search"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2" data-testid="chat-history">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Noch keine Chats.</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-3">
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelect(c.id)}
                      className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        activeId === c.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`}
                      data-testid={`chat-history-item-${c.id}`}
                    >
                      <MessageSquareIcon className="size-3.5 shrink-0" />
                      <span className="truncate">{c.title}</span>
                      <Trash2Icon
                        className="size-3.5 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`'${c.title}' löschen?`)) onDelete(c.id)
                        }}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
