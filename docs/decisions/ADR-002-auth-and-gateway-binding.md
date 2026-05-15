# ADR-002 — Auth-Modell + Hermes-Gateway-Anbindung

- **Status:** Accepted
- **Date:** 2026-05-15
- **Authors:** Oliver, Alice
- **Relates to:** [ADR-001](ADR-001-pivot-to-greenfield.md), Issues #41 #42 #44

---

## Context

Phase 0.3 (Better Auth) und Phase 0.4 (Hermes-Chat) führen zwei separate Vertrauensgrenzen ein, die zusammenspielen müssen:

1. **Frontend-Authentifizierung** — wer darf in Lokyy rein?
2. **Backend-Kommunikation** — wie spricht Lokyy mit dem Hermes-Gateway?

Beide haben unabhängige Sicherheitsmodelle. ADR-001 hat als Lokyy-Personal-Architektur **Single-Tenant pro Installation** festgelegt: Eine Lokyy-Instanz + Eine Hermes-Instanz pro Kunde. Damit kann die Auth-Schicht einfach bleiben.

## Decision

### 1. Auth-Modell (Better Auth)

- **Email + Passwort** als einzige primäre Sign-In-Methode in Phase 0
- **SQLite-DB** lokal in `lokyy-app/data/auth.db` (WAL-Mode, gitignored)
- **httpOnly cookies** mit SameSite=lax, 30-Tage-Session, 1-Tage-Updateage
- **First-Run-Bootstrap**: kein User → `/setup` für Owner-Account, danach `/login`
- **organizations-Plugin aktiv aber ungenutzt** — hält den SaaS-Migrations-Pfad (ADR-001 Architektur B) ohne Refactor offen
- **Kein Email-Verify in Phase 0** — single-user local install, kein Spam-Risiko

#### Schema (von Better Auth migrate erzeugt)

```
user           — id, name, email, emailVerified, image, createdAt, updatedAt
session        — id, expiresAt, token, ipAddress, userAgent, userId, activeOrganizationId
account        — providerId, userId, password (hashed)
verification   — identifier, value, expiresAt
organization   — id, name, slug, logo, metadata, createdAt
member         — organizationId, userId, role
invitation     — organizationId, email, role, status
```

#### Migration

```bash
npx @better-auth/cli migrate -y
```

Playwright-`globalSetup` wiped `data/*.db` + reruns migrate vor jedem E2E-Run.

#### Auth-Guard im Routing

```ts
// src/routes/_authed.tsx
beforeLoad: async () => {
  const session = await getSession()
  if (!session.data?.user) throw redirect({ to: '/login' })
}
```

Alle authentifizierungspflichtigen Routen leben unter `routes/_authed/*` (TanStack pathless layout route).

### 2. Hermes-Gateway-Anbindung

- **OpenAI-kompatibles API** auf `:8642` (Standard-Endpoints)
- **In Dev**: Vite-Dev-Proxy `/api/hermes/*` → `http://127.0.0.1:8642/*` mit Origin/Referer-Strip
- **In Prod (Phase 6)**: noch zu entscheiden — Optionen sind:
  1. Reverse-Proxy (nginx/Caddy) liefert Lokyy + Hermes auf demselben Origin
  2. Hermes-Config `allowed_origins` setzen
  3. Lokyy-Backend-Service als Bridge (kommt sowieso für Lokyy Team/Enterprise)

#### Genutzte Endpoints

| Method | Path | Verwendung |
|---|---|---|
| GET | `/health` | Health-Probe in Chat-Test, Connection-Status-Badge |
| GET | `/v1/models` | Liste verfügbarer Hermes-Profile (für Phase 1 Agent-Galerie) |
| POST | `/v1/chat/completions` | Chat-Round-Trip; aktuell single-shot (`stream: false`) |

Streaming via SSE (`stream: true`) kommt in Phase 1, wenn die echte Chat-UI gebaut wird.

#### CORS-Gotcha

Hermes-Gateway lehnt cross-origin POST mit Origin-Header mit **403 Forbidden** ab. Die Vite-Proxy-Config strippt deshalb `Origin` und `Referer` beim Forwarding:

```ts
configure: (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin')
    proxyReq.removeHeader('referer')
  })
}
```

Das ist akzeptabel, weil Vite-Dev-Server ein vertrauenswürdiger Server-Side-Proxy ist (läuft lokal, vor Better-Auth-Wall).

#### Session-Mapping Lokyy-User ↔ Hermes-Sessions

In Phase 0 **nicht** gewired:
- Hermes liefert `x-hermes-session-id` Header in Chat-Responses
- Lokyy ignoriert das aktuell — jeder Chat-Request ist single-shot ohne Session-Continuität
- Phase 1 wird Hermes-Sessions an Lokyy-User-IDs koppeln (z.B. in einer `lokyy_session_mapping` Tabelle in der Auth-DB oder über Hermes-Metadata)

Architektonisch korrekt: ein Lokyy-User kann mehrere parallele Hermes-Sessions haben (verschiedene Agents, verschiedene Threads). Mapping ist N:M, nicht 1:1.

#### Error-Recovery-Strategie

| Szenario | Verhalten |
|---|---|
| Hermes-Gateway down (TCP refused) | UI zeigt "Hermes-Gateway: offline" Badge, Input disabled, klare Error-Message |
| Gateway responses 5xx | Error im UI angezeigt, Lokyy bleibt funktional |
| Gateway responses 403 (CORS) | Bug — fix in Vite-Proxy-Config oder Hermes-Config |
| Modell nicht erreichbar (z.B. Anthropic-API down) | Hermes liefert Error-Response durch, Lokyy zeigt sie |

### 3. Production-Deploy-Pfad (Phase 6 Open Items)

- **CORS**: Hermes-Config explizit auf Lokyy-Domain whitelisten ODER Reverse-Proxy
- **Auth-Secret**: `LOKYY_AUTH_SECRET` env, nicht hardcoded `dev-secret-...`
- **DB-Migration in Deploy**: `better-auth migrate` als Build-Step
- **API-Server-Key**: Hermes-Gateway-API-Key in Auth-Bridge eingebaut
- **TLS**: Lokyy + Hermes hinter TLS-Terminator
- **Backups**: SQLite-Auth-DB regelmäßig sichern (Owner-Account + Sessions)

## Consequences

### Positiv
- Phase 0 deutlich vereinfacht — keine SaaS-Multi-Tenancy-Komplexität
- Better Auth + Hermes-Profile ist die natürliche Mapping für Lokyy Personal
- Vite-Dev-Proxy mit Origin-Strip löst CORS für Dev sauber
- organizations-Plugin in Better Auth offen lassen → Team/SaaS-Migration ohne Schema-Rewrite

### Negativ
- Single-User-Lock per Installation — wenn Kunde Familie/Team will, muss er Phase 1+ warten (Multi-Profile-Wiring) oder zweite Lokyy-Installation
- Vite-Proxy ist Dev-only — Production-Deploy braucht eigene CORS-Lösung (offen, Phase 6)
- Auth-DB im Repo-Pfad — Backup-Pflicht beim Kunden
- Origin-Strip im Proxy ist akzeptabler Trade-off, aber Bypass für Hermes' Security-Layer — OK weil Vite-Proxy hinter Better-Auth-Wall

### Mitigation
- ADR-002 dokumentiert die Trade-offs damit Phase-6-Polish nicht im Dunkeln läuft
- Mermaid-Diagramm (`docs/architecture/lokyy-personal.mmd`) zeigt die Datenflüsse für Reviewer

## Cross-References

- ADR-001 — Pivot-Decision (warum Greenfield, warum Personal first)
- Mermaid-Diagramm — `docs/architecture/lokyy-personal.mmd`
- Issues — #41 (Auth), #42 (Hermes-Chat), #44 (ADR-002 selbst)
