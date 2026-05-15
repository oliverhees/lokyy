import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MessageSquareIcon, CheckCircle2Icon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchChannels, type ChannelPlatform } from '@/lib/lokyy-hermes'

export const Route = createFileRoute('/_authed/channels')({ component: ChannelsPage })

function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelPlatform[]>([])
  useEffect(() => { fetchChannels().then(setChannels).catch(() => {}) }, [])

  const configured = channels.filter((c) => c.configured).length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Channels</h1>
        <p className="text-sm text-muted-foreground">
          Hermes als Bot in Messaging-Plattformen. {configured}/{channels.length} konfiguriert.
          Setup via <code className="rounded bg-muted px-1">hermes gateway setup</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="channels-grid">
        {channels.map((c) => (
          <Card key={c.id} data-testid={`channel-card-${c.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                  <MessageSquareIcon className="size-5" />
                </div>
                {c.configured ? (
                  <Badge className="gap-1"><CheckCircle2Icon className="size-3" /> aktiv</Badge>
                ) : (
                  <Badge variant="secondary">offen</Badge>
                )}
              </div>
              <CardTitle className="mt-3 text-base">{c.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
