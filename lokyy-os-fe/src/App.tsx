import { useEffect, useState } from "react";

type BackendVersion = {
  service: string;
  version: string;
  phase: string;
};

export default function App() {
  const [backend, setBackend] = useState<BackendVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((v: BackendVersion) => setBackend(v))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6 text-center">
        <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
          Lokyy
        </h1>
        <p className="text-zinc-400 text-lg">
          KI-Betriebssystem — Phase-1 foundation scaffold.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left text-sm font-mono">
          <div className="text-zinc-500 mb-1">/api/version</div>
          {error && <div className="text-red-400">error: {error}</div>}
          {backend && (
            <pre className="text-zinc-300">{JSON.stringify(backend, null, 2)}</pre>
          )}
          {!backend && !error && <div className="text-zinc-500">loading…</div>}
        </div>
        <p className="text-xs text-zinc-600">
          Authentication arrives in Phase-1b. See{" "}
          <a
            href="https://github.com/oliverhees/lokyy/blob/main/ISA.md"
            className="underline hover:text-zinc-400"
            target="_blank"
            rel="noreferrer"
          >
            ISA.md
          </a>{" "}
          for the architecture.
        </p>
      </div>
    </main>
  );
}
