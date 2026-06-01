import { useEffect, useState } from 'react'
import { BellIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Permission = NotificationPermission | 'unsupported'

function currentPermission(): Permission {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export function NotificationsPermissionCard() {
  const [perm, setPerm] = useState<Permission>('default')

  useEffect(() => {
    setPerm(currentPermission())
  }, [])

  if (perm === 'unsupported' || perm === 'granted') return null

  async function request() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPerm(result)
  }

  return (
    <Card data-testid="notifications-permission">
      <CardContent className="flex items-start gap-3 p-4">
        <BellIcon className="size-5 shrink-0 text-muted-foreground" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">Browser-Benachrichtigungen sind aus</p>
          <p className="text-xs text-muted-foreground">
            Ohne Berechtigung kommen Reminder nur als In-App-Toast — sichtbar nur wenn dieser Tab
            offen und fokussiert ist. Mit Berechtigung popt eine OS-Notification mit Sound auch
            wenn Lokyy im Hintergrund läuft. (Wenn der Browser ganz geschlossen ist, hilft das
            nicht — dafür kommt Web-Push in Iteration C.)
          </p>
          {perm === 'denied' ? (
            <p className="text-xs text-destructive">
              Berechtigung wurde abgelehnt. Aktiviere sie manuell in den Browser-Einstellungen für lokyy.local.
            </p>
          ) : null}
        </div>
        {perm === 'default' ? (
          <Button size="sm" onClick={() => void request()} data-testid="notifications-permission-enable">
            Aktivieren
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
