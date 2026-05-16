import { useState } from 'react'
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp, getSession } from '@/lib/auth-client'

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session.data?.user) throw redirect({ to: '/dashboard' })
    const res = await fetch('/api/lokyy/owner-exists')
    if (res.ok) {
      const data = (await res.json()) as { ownerExists: boolean }
      if (data.ownerExists) throw redirect({ to: '/login' })
    }
  },
  component: SetupPage,
})

function SetupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signUpError } = await signUp.email({ email, password, name })
    setBusy(false)
    if (signUpError) {
      setError(signUpError.message ?? 'Setup fehlgeschlagen')
      return
    }
    await navigate({ to: '/dashboard' })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">Lokyy</h1>
          <CardTitle className="text-base font-normal text-muted-foreground">Einrichten</CardTitle>
          <CardDescription>
            Lege deinen Owner-Account an. Das ist der einzige Setup-Schritt — danach kannst du Lokyy direkt nutzen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Lege an…' : 'Owner-Account anlegen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
