import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BotIcon,
  ChartBarIcon,
  ChevronRightIcon,
  KanbanSquareIcon,
  MessageSquareIcon,
  WrenchIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchInsights, fetchTools } from "@/lib/lokyy-hermes";
import { listKanban } from "@/lib/lokyy-kanban";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
});

type Stats = {
  sessions: number | null;
  totalTokens: number | null;
  openTasks: number | null;
  agents: number | null;
  toolsEnabled: number | null;
  recentSessions: SessionRow[];
};

type SessionRow = {
  id: string;
  title: string;
  model: string;
  startedAt: number;
};

const EMPTY: Stats = {
  sessions: null,
  totalTokens: null,
  openTasks: null,
  agents: null,
  toolsEnabled: null,
  recentSessions: [],
};

function DashboardPage() {
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    void (async () => {
      const [insights, tools, kanban, agents, sessions] = await Promise.allSettled([
        fetchInsights(30),
        fetchTools(),
        listKanban(),
        fetch("/api/lokyy/agents").then((r) => r.json()),
        fetch("/api/lokyy/sessions").then((r) => r.json()),
      ]);
      setStats({
        sessions:
          insights.status === "fulfilled" ? insights.value.summary.sessions ?? 0 : null,
        totalTokens:
          insights.status === "fulfilled" ? insights.value.summary.totalTokens ?? 0 : null,
        openTasks:
          kanban.status === "fulfilled"
            ? kanban.value.tasks.filter((t) => t.status !== "done").length
            : null,
        agents:
          agents.status === "fulfilled" ? (agents.value.agents?.length ?? 0) : null,
        toolsEnabled:
          tools.status === "fulfilled"
            ? tools.value.tools.filter((t) => t.enabled).length
            : null,
        recentSessions:
          sessions.status === "fulfilled"
            ? mapRecentSessions(sessions.value.sessions ?? [])
            : [],
      });
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Übersicht über Sessions, Tasks, Agents und Tools der letzten 30 Tage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-stats">
        <StatCard
          label="Sessions (30d)"
          value={stats.sessions}
          sub={stats.totalTokens != null ? `${stats.totalTokens.toLocaleString()} tokens` : null}
          href="/insights"
          icon={<MessageSquareIcon className="size-5" />}
        />
        <StatCard
          label="Offene Tasks"
          value={stats.openTasks}
          sub="Hermes-Kanban"
          href="/tasks"
          icon={<KanbanSquareIcon className="size-5" />}
        />
        <StatCard
          label="Agents"
          value={stats.agents}
          sub="Lokyy + Hermes-Profile"
          href="/agents"
          icon={<BotIcon className="size-5" />}
        />
        <StatCard
          label="Tools aktiv"
          value={stats.toolsEnabled}
          sub="Toolsets enabled"
          href="/tools"
          icon={<WrenchIcon className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartBarIcon className="size-4 text-muted-foreground" />
            Letzte Sessions
          </CardTitle>
          <Link
            to="/sessions"
            className="text-muted-foreground hover:text-foreground inline-flex items-center text-xs"
          >
            alle anzeigen <ChevronRightIcon className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Sessions in den letzten 30 Tagen.</p>
          ) : (
            <ul className="divide-y divide-border" data-testid="recent-sessions">
              {stats.recentSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title || s.id}</p>
                    <p className="text-muted-foreground text-xs">{formatRelative(s.startedAt)}</p>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                    {s.model}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
  icon,
}: {
  label: string;
  value: number | null;
  sub: string | null;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link to={href}>
      <Card className="transition hover:border-foreground/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </CardTitle>
          <span className="text-muted-foreground">{icon}</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold leading-none">
            {value == null ? "…" : value.toLocaleString()}
          </div>
          {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
        </CardContent>
      </Card>
    </Link>
  );
}

type RawSession = {
  id: string;
  title?: string;
  model?: string;
  started_at?: number;
};

function mapRecentSessions(raw: RawSession[]): SessionRow[] {
  return [...raw]
    .filter((s): s is RawSession & { started_at: number } => typeof s.started_at === "number")
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      title: s.title ?? s.id,
      model: s.model ?? "—",
      startedAt: s.started_at,
    }));
}

function formatRelative(epochSeconds: number): string {
  const nowSec = Date.now() / 1000;
  const diff = nowSec - epochSeconds;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `vor ${Math.floor(diff / 3600)} h`;
  return `vor ${Math.floor(diff / 86_400)} d`;
}
