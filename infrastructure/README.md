# infrastructure/ — Lokyy KI-OS Docker Stack (Etappe-2)

Production-ready Docker Compose stack for the Lokyy KI-Betriebssystem.

> **Canonical decisions live in [`../docs/decisions/ADR-003-docker-topology-etappe-2.md`](../docs/decisions/ADR-003-docker-topology-etappe-2.md).**
> **ISA (system of record): [`../ISA.md`](../ISA.md).**

## Quick Start

```bash
cd infrastructure/

# 1. Copy environment template
cp .env.example .env.local
chmod 0600 .env.local

# 2. Fill in real values (DOMAIN, ACME_EMAIL, TRAEFIK_DASHBOARD_AUTH, FORGEJO_*)
${EDITOR:-nano} .env.local

# 3. Generate the Traefik dashboard password
htpasswd -nbB admin 'YOUR-STRONG-PASSWORD' | sed 's/\$/\$\$/g'
#   → paste the line into TRAEFIK_DASHBOARD_AUTH in .env.local

# 4. For local dev, add hosts entries (sudo required)
echo "127.0.0.1 lokyy.local traefik.lokyy.local" | sudo tee -a /etc/hosts

# 5. Start the stack (dev mode → Let's Encrypt staging, debug logs)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 6. Verify
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
#   → all services should report "healthy"

curl -kI https://traefik.lokyy.local/
#   → HTTP/2 401  (dashboard requires auth — proves routing + TLS work)
```

## Phase-0 Done-Gate

- [ ] `docker compose -f docker-compose.yml config` validates without errors
- [ ] `docker compose up -d` brings all 5 active services `healthy` within 60 s
- [ ] `curl -kI https://traefik.${DOMAIN}/` returns `401 Unauthorized` (proves TLS + routing + auth middleware)
- [ ] With correct basic-auth credentials, `https://traefik.${DOMAIN}/dashboard/` returns `200 OK`
- [ ] Traefik dashboard lists all five active services with green status
- [ ] Playwright screenshot of the dashboard (logged in) attached to Phase-0 Issue

## Service Inventory

| Service | Image | Phase | Public? | Role |
|---------|-------|-------|:---:|------|
| `traefik` | `traefik:latest` | 0 ✅ | yes | Reverse-proxy + auto-TLS + dashboard |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:latest` | 0 ✅ | no | Sanitized Docker API for Traefik (anti-privilege gate) |
| `lokyy-os-fe` | `nginx:alpine` (placeholder) | 0 ✅ → 1 | yes | Frontend |
| `lokyy-os-be` | `nginx:alpine` (placeholder) | 0 ✅ → 1 | yes (`/api`) | Backend auth-gateway |
| `lokyy-brain` | `nginx:alpine` (placeholder) | 0 ✅ → 3 | **no** | Second-Brain HTTP-API (internal only — ISC-44) |
| `hermes` | `nousresearch/hermes-agent` | 2 🔒 | no | Agent core (commented; activate in Phase-2) |
| `lokyy-heartbeat-supervisor` | own build | 2 🔒 | no | Layer-3 watchdog (commented; activate in Phase-2) |

> **Forgejo runs remotely** (not part of this stack). `lokyy-brain` is configured via `LOKYY_BRAIN_FORGEJO_URL` in `.env.local` to point at the existing external Forgejo. Bringing Forgejo into the local stack would duplicate working infrastructure.

## Networks

- **`lokyy-net`** — internal bridge, all services attach.
- **`traefik-public`** — external bridge, only Traefik attaches and exposes `:80` / `:443`.

This split enforces **ISC-44**: `lokyy-brain` cannot be reached from the public internet.

## Volumes (persistent, named)

- `lokyy-traefik-letsencrypt` — TLS certs (`acme.json`)

Future volumes (declared in compose, currently commented): `lokyy-brain-vault` (Phase-3 working clone of remote Forgejo), `lokyy-os-db`, `hermes-data`, `heartbeat-state`.

## Migration Note (Etappe-1 → Etappe-2)

The directories `../lokyy-workspace/` and `../lokyy-app/` are Etappe-1 artefacts (per ADR-001 pivot decision). They are **not** part of this Etappe-2 stack and will be retired in Phase-1 as `lokyy-os-fe` and `lokyy-os-be` come online with real images.

If you currently run the Etappe-1 stack, stop it before bringing this one up to avoid port conflicts on `:80` / `:443`.

## Operating

### Logs
```bash
docker compose logs -f traefik
docker compose logs -f forgejo
```

### Restart a single service
```bash
docker compose restart traefik
```

### Tear down (preserves volumes)
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### Tear down + delete data (⚠ irreversible)
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

### Switch dev → production
Remove the `-f docker-compose.dev.yml` override. Production uses real Let's Encrypt CA — make sure your hostnames resolve publicly first.

## Troubleshooting

**Healthcheck failing on first run**
Forgejo needs ~30 s for first-run DB init. Wait and recheck. `start_period: 60s` is set generously.

**TLS warning in browser**
Dev mode uses Let's Encrypt **staging** CA — certs are not browser-trusted. Expected. Use `curl -k` to test.

**`traefik.lokyy.local` resolves but 404**
Check that the `/etc/hosts` entry is present and the `traefik` container is healthy (`docker compose ps`).

**Port 80 or 443 already in use**
Another service is binding (probably the Etappe-1 `lokyy-workspace/docker-compose.yml`). Stop it first:
```bash
docker compose -f ../lokyy-workspace/docker-compose.yml down
```

## See Also

- [`../ISA.md`](../ISA.md) — full Lokyy KI-OS architecture (81 ISCs)
- [`../docs/decisions/ADR-003-docker-topology-etappe-2.md`](../docs/decisions/ADR-003-docker-topology-etappe-2.md) — this stack's decisions
- [`../docs/decisions/ADR-001-pivot-to-greenfield.md`](../docs/decisions/ADR-001-pivot-to-greenfield.md) — why Etappe-2 exists
- [`../docs/decisions/ADR-002-auth-and-gateway-binding.md`](../docs/decisions/ADR-002-auth-and-gateway-binding.md) — Etappe-1 auth (Phase-1 of Etappe-2 supersedes)
