# Lokyy KI-OS

> **Dein eigenes KI-Betriebssystem auf deinem eigenen Server.** Tasks, Agents, Workflows, Tools, Memory — alles unter deiner Kontrolle, alle Daten bei dir.

![status](https://img.shields.io/badge/status-personal--beta-blueviolet) ![license](https://img.shields.io/badge/license-MIT-green)

Lokyy ist ein selbst-gehostetes KI-Betriebssystem, gebaut auf [Hermes Agent](https://github.com/nousresearch/hermes-agent). Du bekommst:

- 🧠 **Chat mit echten KI-Agenten** (Claude, GPT, OpenRouter — du wählst)
- 📋 **Schedule-Jobs** — Cron-getriggerte Hermes-Prompts (z.B. "fasse jeden Morgen meine Emails zusammen")
- 📝 **Prompt-Library** + **Teams** — wiederverwendbare Prompts + Multi-Agent-Konfigurationen
- 🔧 **24 Tools** ins Hermes-Setup (Web-Search, Code-Execution, Browser, Memory, …)
- 📊 **Insights-Dashboard** über Token-Verbrauch, Sessions, Tool-Calls
- 🗂 **Vault** für read-only Anbindung deines Obsidian-Vaults
- 🛡 **Eigener Server, eigene Daten** — keine Telemetrie, keine SaaS-Bindung

---

## Was du brauchst

| | |
|---|---|
| **Betriebssystem** | Linux (Ubuntu 22.04+, Debian 12+, Fedora 39+) oder macOS. Windows mit WSL2 sollte gehen, ist aber nicht getestet. |
| **Docker** | Engine 24.x oder neuer + das Compose-Plugin. → [Install-Guide](https://docs.docker.com/engine/install/) |
| **RAM** | Mindestens 4 GB frei; 8 GB+ empfohlen |
| **Disk** | ~5 GB für Container-Images + Platz für deine Daten |
| **Ein LLM-Provider-Key** | OpenRouter, Anthropic ODER OpenAI — du brauchst nur einen. (OpenRouter hat einen Free-Tier zum Ausprobieren.) |
| **Domain (optional)** | Für lokale Installation reicht `lokyy.local`. Für "richtige" Installation mit Let's-Encrypt brauchst du eine Domain die auf den Server zeigt. |

---

## Installation in 5 Minuten

### 1. Repository klonen

```bash
git clone https://github.com/oliverhees/lokyy.git
cd lokyy
```

### 2. Setup-Wizard starten

```bash
./scripts/install-lokyy.sh
```

Der Wizard fragt dich:

1. **Domain** — bei lokaler Installation einfach `lokyy.local` (default).
2. **Email** für Let's-Encrypt (nur relevant bei echter Domain).
3. **Traefik-Dashboard-Passwort** — wähl ein gutes, du brauchst es selten.
4. **LLM-Provider-Key** — wähle 1–3 (OpenRouter / Anthropic / OpenAI) und füge deinen Key ein. **Genau einen brauchst du.**

Der Wizard:
- ✅ generiert alle internen Secrets automatisch (du musst nichts wissen)
- ✅ schreibt `infrastructure/.env.local` (privat, `chmod 0600`)
- ✅ trägt bei `*.local`-Domain auf Wunsch `/etc/hosts` ein (braucht `sudo`)
- ✅ baut + startet alle Container
- ✅ wartet bis alles `healthy` ist

Beim ersten Start dauert das Bauen ~5–10 Minuten, danach Sekunden.

### 3. Lokyy öffnen

Der Wizard druckt am Ende:

```
→ App:           https://lokyy.local
→ Traefik-Dash:  https://traefik.lokyy.local
→ Hermes-Dash:   https://hermes.lokyy.local
```

Öffne **https://lokyy.local** im Browser.

- Bei `*.local`-Domain wird das Zertifikat **selbstsigniert** sein → Warnung akzeptieren.
- Auf der Login-Seite auf **„Registrieren"** klicken
- Email + Passwort wählen → das wird dein Lokyy-Admin-Account

Fertig. Du landest auf dem Dashboard.

---

## Was du jetzt sehen solltest

Direkt nach dem Login:

- **Dashboard** — Sessions, Tasks, Agents, Tools-Counter (am Anfang alles 0, weil noch nichts erstellt)
- **Chat** — leg los und sprich mit Hermes; die erste Antwort kommt vom Provider den du eingerichtet hast
- **Tasks** — Hermes-Kanban (4 Spalten: To Do / In Progress / Blocked / Done)
- **Tools** — 24 Toolsets von Hermes; manche sind enabled, manche brauchen Provider-Keys
- **Channels** — 14 Messaging-Plattformen die Hermes als Bot bedienen kann (Telegram, Discord, Slack, …); alle initial *disconnected*
- **Schedule Jobs** — leer; "Neuer Job" → Schedule (z.B. `0 9 * * *` für täglich 9 Uhr) + Prompt → läuft

---

## Optional: Obsidian-Vault verbinden

Lokyy kann deinen Obsidian-Vault read-only lesen.

1. In `infrastructure/docker-compose.yml` beim `lokyy-os-be`-Service den auskommentierten Volume-Mount aktivieren:
   ```yaml
   volumes:
     - lokyy-os-db:/app/data
     - /pfad/zu/deinem/obsidian-vault:/vault:ro
   ```
2. In `infrastructure/.env.local`:
   ```
   LOKYY_VAULT_PATH=/vault
   ```
3. Container neu starten:
   ```bash
   cd infrastructure
   docker compose --env-file .env.local up -d lokyy-os-be
   ```
4. `/vault` im Lokyy-Menü zeigt jetzt deine Markdown-Notes.

---

## Optional: Hermes mit Telegram/Discord/Slack verbinden

Hermes kann als Bot in Messaging-Plattformen agieren. Setup läuft heute über die Hermes-CLI:

```bash
# Im Hermes-Container einloggen
docker exec -it lokyy-hermes /opt/hermes/.venv/bin/hermes gateway setup

# Folge den interaktiven Prompts (Telegram-Token, Discord-Webhook etc.)
```

Nach erfolgreichem Setup taucht die Plattform unter **/channels** als "konfiguriert" auf.

---

## Tägliche Bedienung

### Stoppen / Neustarten

```bash
cd infrastructure

# Stoppen
docker compose --env-file .env.local stop

# Wieder starten (Images nicht neu bauen)
docker compose --env-file .env.local up -d

# Einzelnen Service neustarten (z.B. nach env-Änderung)
docker compose --env-file .env.local restart lokyy-os-be
```

### Logs anschauen

```bash
cd infrastructure

# Alle Services
docker compose --env-file .env.local logs -f

# Nur Backend
docker compose --env-file .env.local logs -f lokyy-os-be

# Nur Hermes
docker compose --env-file .env.local logs -f hermes
```

### Update auf neue Lokyy-Version

```bash
git pull
./scripts/install-lokyy.sh   # idempotent, behält bestehende Secrets
```

Der Wizard erkennt deine bestehende `.env.local` und ändert nur was sich strukturell geändert hat. Deine Daten (Tasks, Jobs, Prompts, Teams) liegen in einem benannten Docker-Volume und bleiben erhalten.

### Backup

```bash
# Eingebauter Hermes-Backup
docker exec lokyy-hermes /opt/hermes/.venv/bin/hermes backup
# legt eine .zip in /opt/data/backups/ ab — schau im Volume nach

# Lokyy-eigene Daten (Tasks, Jobs, Prompts, Teams, Settings)
docker run --rm -v lokyy-lokyy-os-db:/data -v $(pwd):/backup alpine \
  tar czf /backup/lokyy-data-$(date +%F).tgz -C /data .
```

---

## Troubleshooting

### "https://lokyy.local antwortet nicht"

```bash
# Container alle healthy?
cd infrastructure
docker compose --env-file .env.local ps

# /etc/hosts richtig?
grep lokyy.local /etc/hosts
# erwartet: 127.0.0.1 lokyy.local traefik.lokyy.local hermes.lokyy.local
```

Wenn die Zeile fehlt → re-run `./scripts/install-lokyy.sh`, beim hosts-Prompt mit `y` bestätigen.

### "Chat antwortet nicht"

```bash
# Hermes-Logs zeigen den Grund
docker compose --env-file infrastructure/.env.local logs --tail 50 hermes
```

Häufige Ursachen:
- LLM-Provider-Key falsch / nicht gesetzt → `infrastructure/.env.local` prüfen, dort `OPENROUTER_API_KEY=` / `ANTHROPIC_API_KEY=` / `OPENAI_API_KEY=` muss einen echten Key enthalten
- Kein Guthaben beim Provider → bei OpenRouter / OpenAI prüfen
- Netzwerk-Block (Firewall? Proxy?) → `docker exec lokyy-hermes curl -s https://openrouter.ai` testen

### "Settings zeigt ‚lade…' endlos"

Das war ein Bug bis 2026-05-18, in der aktuellen main behoben. Wenn er trotzdem auftritt:

```bash
docker compose --env-file infrastructure/.env.local logs --tail 30 lokyy-os-be
```

Wahrscheinlich Hermes nicht erreichbar — siehe „Chat antwortet nicht".

### "Container bleibt unhealthy"

```bash
# Zeigt welcher genau und warum
docker compose --env-file infrastructure/.env.local ps
docker inspect --format='{{.State.Health.Status}}: {{.State.Health.Log}}' <containername>
```

### Komplett-Neustart von Null

```bash
cd infrastructure
docker compose --env-file .env.local down -v   # !! löscht alle Daten !!
cd ..
./scripts/install-lokyy.sh
```

---

## Architektur (für Neugierige)

Lokyy besteht aus 9 Containern auf einem geteilten Docker-Netzwerk:

| Service | Was es macht |
|---|---|
| `traefik` | Reverse-Proxy + Auto-TLS (Let's-Encrypt oder self-signed) |
| `lokyy-os-fe` | React-SPA (TanStack Router + Tailwind + xyflow) |
| `lokyy-os-be` | Bun + Hono Backend; Auth via Better-Auth; sqlite für Lokyy-Daten |
| `lokyy-mcp` | Lokyy System Bus (System-Skills + Cron-Scheduler) |
| `lokyy-brain` | Memory-Layer (Phase-3, optional, wenn Forgejo angebunden) |
| `lokyy-supervisor` | Hermes-Healthcheck-Loop |
| `hermes` | Hermes Agent (LLM-Gateway, Tool-Runner) |
| `hermes-dashboard` | Hermes' eigene Web-UI (intern, hinter Traefik) |
| `docker-socket-proxy` | tecnativa/docker-socket-proxy für sichere Container-Steuerung |

Frontend-Stack: React 19 · TypeScript · Vite · Tailwind 4 · TanStack Router · Zustand · xyflow
Backend-Stack: Bun · Hono · Better-Auth · bun:sqlite · Kysely

Volle Architektur-Doku unter `docs/decisions/ADR-003-docker-topology-etappe-2.md`.

---

## Lizenz

MIT — siehe [`LICENSE`](LICENSE). Lokyy basiert auf [Hermes Agent](https://github.com/nousresearch/hermes-agent) (ebenfalls MIT). Attribution siehe [`NOTICE`](NOTICE).

---

## Mitmachen

- **Bugs** → [GitHub Issues](https://github.com/oliverhees/lokyy/issues)
- **Feature-Requests** → erst die [bestehenden Issues](https://github.com/oliverhees/lokyy/issues) durchsuchen, dann neuen anlegen
- **Code-Beiträge** → PRs willkommen; bitte `docs/decisions/` lesen bevor du größere Architektur-Änderungen vorschlägst
