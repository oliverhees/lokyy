import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, useSession } from "../auth-client";
import { api, type ApiVersion } from "../lib/api";

export default function Dashboard() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [version, setVersion] = useState<ApiVersion | null>(null);

  useEffect(() => {
    api.version().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isPending && !session) navigate("/login", { replace: true });
  }, [isPending, session, navigate]);

  if (isPending || !session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center">
        loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
          Lokyy
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-400">
            {session.user.name || session.user.email}
          </span>
          <button
            data-testid="signout-button"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
            className="rounded-md border border-zinc-800 px-3 py-1 hover:bg-zinc-900 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="max-w-3xl mx-auto p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold tracking-tight">Welcome.</h2>
          <p className="text-zinc-400">
            You're signed in. The real dashboard with agent state, heartbeat,
            and activity log lands in Phase-1c / Phase-2.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">
            Session
          </div>
          <div className="font-mono text-zinc-300 space-y-0.5">
            <div>email: {session.user.email}</div>
            <div>id: {session.user.id}</div>
            {version && <div>backend: {version.service} v{version.version} ({version.phase})</div>}
          </div>
        </div>

        <div className="text-xs text-zinc-600">
          Phase-1b auth flow. Better-Auth + SQLite, httpOnly session cookies
          (SameSite=lax), 30-day session with 1-day refresh.
        </div>
      </section>
    </main>
  );
}
