import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold tracking-tight">Lokyy</h1>
      <p className="text-sm text-zinc-400">Phase 0.1 — Scaffold</p>
    </main>
  )
}
