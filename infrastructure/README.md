# infrastructure/

Docker-Compose-Stack für Lokyy KI-OS. **Für den normalen Install brauchst du das hier nicht zu lesen** — folge dem [Top-Level-README](../README.md) und nutze `scripts/install-lokyy.sh`.

Dieses README ist nur für Leute die im Stack hacken oder ihn manuell hochfahren wollen.

## Quick reference

```bash
# Aus dem Repo-Root, NICHT aus diesem Verzeichnis:
bash scripts/install-lokyy.sh        # Wizard: schreibt .env.local + bringt alles hoch

# Manuell (wenn .env.local schon existiert):
cd infrastructure
docker compose --env-file .env.local up -d
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs -f lokyy-os-be
docker compose --env-file .env.local stop
docker compose --env-file .env.local down -v   # !!! löscht Volumes !!!
```

## Stack-Inventar

9 Services auf einem geteilten `lokyy-net`:

| Service | Image | Öffentlich? | Rolle |
|---------|-------|:---:|------|
| `traefik` | `traefik:latest` | ✅ | Reverse-Proxy + Auto-TLS (Let's-Encrypt oder self-signed) |
| `lokyy-os-fe` | gebaut aus `../lokyy-app` | ✅ | React-SPA |
| `lokyy-os-be` | gebaut aus `../lokyy-os-be` | ✅ | Bun + Hono Backend |
| `hermes` | `nousresearch/hermes-agent:latest` | ✅ | Hermes-Agent (LLM-Gateway) |
| `hermes-dashboard` | `nousresearch/hermes-agent:latest` | ✅ | Hermes' eigene Web-UI |
| `lokyy-mcp` | gebaut aus `../lokyy-mcp` | ❌ intern | System-Bus + Cron-Scheduler |
| `lokyy-brain` | `nginx:alpine` (Placeholder) | ❌ intern | Second-Brain (Phase-3) |
| `lokyy-supervisor` | gebaut aus `./supervisor` | ❌ intern | Hermes-Healthcheck-Loop |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy` | ❌ intern | restringierter Docker-API-Zugang |

## Volumes

| Volume | Inhalt | Backup-Strategie |
|--------|--------|------------------|
| `lokyy-os-db` | `auth.db` + `lokyy.db` (User, Tasks, Jobs, Prompts, Teams) | `tar` über das Volume |
| `lokyy-hermes-data` | `~/.hermes/` im Container (Memory, Kanban, Sessions, Profiles) | `hermes backup` im Container |
| `lokyy-traefik-letsencrypt` | Let's-Encrypt-Cert-Cache | regenerierbar |

## Dev-Override

`docker-compose.dev.yml` aktiviert:
- Let's-Encrypt-**Staging**-Server (für Tests, keine echten Limits)
- Mehr Debug-Logging in Traefik

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.local up -d
```

## Variables

Alle env-vars sind in [`.env.example`](.env.example) mit Kommentaren. Kurz:

| Var | Wozu |
|-----|------|
| `DOMAIN` | Hauptdomain (z.B. `lokyy.deine-domain.de` oder `lokyy.local`) |
| `TRAEFIK_DASHBOARD_HOST` / `HERMES_DASHBOARD_HOST` | Subdomains für interne Dashboards |
| `ACME_EMAIL` | Email für Let's-Encrypt |
| `BETTER_AUTH_SECRET` | Cookie-Signing in lokyy-os-be |
| `LOKYY_SYSTEM_SECRET` | Bearer für interne lokyy-mcp-Calls |
| `HERMES_API_KEY` | Bearer für Hermes' eigenen HTTP-Server |
| `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Mindestens einer; das LLM-Backend |
| `LOKYY_VAULT_HOST_PATH` / `LOKYY_VAULT_PATH` | Optional: Obsidian-Mount für `/vault` |

Standard: `install-lokyy.sh` generiert alle Secrets selbst, fragt nur was er nicht erraten kann (Domain, Email, Provider-Key).
