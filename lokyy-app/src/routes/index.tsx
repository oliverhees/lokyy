import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@/lib/auth-client'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session.data?.user) throw redirect({ to: '/dashboard' })
    const res = await fetch('/api/lokyy/owner-exists').catch(() => null)
    if (res && res.ok) {
      const data = (await res.json()) as { ownerExists: boolean }
      throw redirect({ to: data.ownerExists ? '/login' : '/setup' })
    }
    throw redirect({ to: '/login' })
  },
})
