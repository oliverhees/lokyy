import * as React from "react";
import { ActivityIcon, BellIcon, CheckIcon, ClockIcon, ShieldAlertIcon, XCircleIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

type ActivityEvent = {
  at: string;
  kind:
    | "tick"
    | "hermes-down"
    | "hermes-restart"
    | "hermes-restart-failed"
    | "hermes-missing"
    | "catch-up";
  service?: string;
  message?: string;
  ok?: boolean;
};

const LAST_SEEN_KEY = "lokyy:activity:lastSeenAt";
const POLL_MS = 30_000;

const KIND_TEXT: Record<ActivityEvent["kind"], string> = {
  "tick": "Heartbeat OK",
  "hermes-down": "Hermes nicht erreichbar",
  "hermes-restart": "Hermes neu gestartet",
  "hermes-restart-failed": "Hermes-Restart fehlgeschlagen",
  "hermes-missing": "Hermes-Container fehlt — manueller Eingriff nötig",
  "catch-up": "Aufwach-Lücke erkannt",
};

function KindIcon({ kind, ok }: { kind: ActivityEvent["kind"]; ok?: boolean }) {
  if (kind === "tick" && ok) return <CheckIcon className="size-4 text-emerald-500" />;
  if (kind === "hermes-restart" && ok) return <ActivityIcon className="size-4 text-amber-500" />;
  if (kind === "hermes-restart-failed") return <XCircleIcon className="size-4 text-destructive" />;
  if (kind === "hermes-missing") return <XCircleIcon className="size-4 text-destructive" />;
  if (kind === "hermes-down") return <ShieldAlertIcon className="size-4 text-destructive" />;
  if (kind === "catch-up") return <ClockIcon className="size-4 text-muted-foreground" />;
  return <ActivityIcon className="size-4" />;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

const Notifications = () => {
  const isMobile = useIsMobile();
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [lastSeenAt, setLastSeenAt] = React.useState<string>(
    () => (typeof window !== "undefined" && window.localStorage.getItem(LAST_SEEN_KEY)) || "1970-01-01T00:00:00.000Z"
  );

  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/api/lokyy/activity", { credentials: "same-origin" });
        if (!r.ok) return;
        const data = (await r.json()) as { events?: ActivityEvent[] };
        if (cancelled) return;
        // Reverse so newest comes first in the dropdown
        setEvents((data.events ?? []).slice().reverse());
      } catch {
        // network glitch — silently retry next tick
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const unseenCount = events.filter((e) => e.at > lastSeenAt).length;

  function markSeen() {
    if (events.length === 0) return;
    const newest = events[0]!.at;
    window.localStorage.setItem(LAST_SEEN_KEY, newest);
    setLastSeenAt(newest);
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && markSeen()}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          className="relative"
          data-testid="activity-bell"
          aria-label={`Aktivität — ${unseenCount} ungelesen`}
        >
          <BellIcon />
          {unseenCount > 0 && (
            <span
              className="bg-destructive absolute end-0.5 top-0.5 block size-1.5 shrink-0 rounded-full"
              data-testid="activity-bell-dot"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isMobile ? "center" : "end"}
        className="ms-4 w-96 p-0"
        data-testid="activity-panel"
      >
        <DropdownMenuLabel className="bg-background dark:bg-muted sticky top-0 z-10 p-0">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="font-medium">Aktivität</div>
            <div className="text-muted-foreground text-xs">
              {events.length === 0 ? "leer" : `${events.length} Einträge`}
            </div>
          </div>
        </DropdownMenuLabel>

        <ScrollArea className="h-[420px]">
          {events.length === 0 ? (
            <div className="text-muted-foreground p-6 text-sm">
              Noch keine Aktivität. Der Supervisor schreibt im 60s-Takt.
            </div>
          ) : (
            events.map((e, idx) => (
              <DropdownMenuItem
                key={`${e.at}-${idx}`}
                className="group flex cursor-default items-start gap-3 rounded-none border-b px-4 py-3"
                data-testid={`activity-event-${e.kind}`}
              >
                <div className="flex-none pt-0.5">
                  <KindIcon kind={e.kind} ok={e.ok} />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="text-sm font-medium">
                    {KIND_TEXT[e.kind] ?? e.kind}
                  </div>
                  {e.message && (
                    <div className="text-muted-foreground line-clamp-2 text-xs">
                      {e.message}
                    </div>
                  )}
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <ClockIcon className="size-3!" />
                    vor {relativeTime(e.at)}
                  </div>
                </div>
                {e.at > lastSeenAt && (
                  <span className="bg-primary/70 mt-1.5 block size-2 flex-none rounded-full" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
