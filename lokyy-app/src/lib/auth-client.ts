import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3100',
  plugins: [organizationClient()],
})

export const { useSession, signIn, signUp, signOut, getSession } = authClient
