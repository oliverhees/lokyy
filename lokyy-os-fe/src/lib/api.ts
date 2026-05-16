/**
 * Small typed wrapper around the lokyy-os-be JSON API (non-auth endpoints).
 */

export type ApiVersion = {
  service: string;
  version: string;
  phase: string;
};

export type SetupNeeded = { setupNeeded: boolean };

export type Me = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    createdAt: string;
  };
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init });
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  version: () => getJson<ApiVersion>("/api/version"),
  setupNeeded: () => getJson<SetupNeeded>("/api/setup-needed"),
  me: () => getJson<Me>("/api/me"),
};
