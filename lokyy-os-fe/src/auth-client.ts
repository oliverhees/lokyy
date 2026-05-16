/**
 * Better-Auth React client.
 * Talks to lokyy-os-be at /api/auth/* via the Traefik route.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;
