# Lokyy KI-OS

> **Dein eigenes KI-Betriebssystem auf deinem eigenen Server.** Hermes-Agent + Workflows + Tasks + Memory + Tools — alles in einem Stack, alle Daten bei dir.

![status](https://img.shields.io/badge/status-personal--beta-blueviolet) ![license](https://img.shields.io/badge/license-AGPL--3.0-blue)

---

## ⚡ Was das ist

Lokyy ist ein **selbst-gehostetes KI-Betriebssystem** rund um [Hermes Agent](https://github.com/NousResearch/hermes-agent). Du klonst ein Repo, lässt einen Wizard laufen, öffnest den Browser — und hast deinen eigenen KI-Stack inkl. Web-UI, Chat, Agents, Schedule-Jobs und Tools.

**Hermes ist gebundled.** Du musst Hermes nicht separat installieren — Lokyy bringt das Hermes-Image im Docker-Stack mit. Ein Install, ein Stack, neun Container.

## 🎯 Was du bekommst

- 🧠 **Chat** mit echten KI-Agenten (Claude, GPT, OpenRouter, was du willst)
- 📋 **Schedule-Jobs** — Cron-getriggerte Prompts ("fasse jeden Morgen meine Emails zusammen")
- 📝 **Prompt-Library** + **Teams** — wiederverwendbare Prompts + Multi-Agent-Mixe
- 🔧 **24 Tools** ins Hermes-Setup (Web-Search, Code-Execution, Browser, Memory, …)
- 📊 **Insights-Dashboard** über Token-Verbrauch, Sessions, Tool-Calls
- 🔗 **Workflows** mit DAG-Editor (Trigger → LLM → Speichern), Cron + Webhook-Trigger
- 🗂 **Vault-Anbindung** (Obsidian read-only, bis lokyy-brain in Phase-3 landet)
- 📡 **Channels** — Hermes als Bot in Telegram, Discord, Slack, Matrix, Signal …
- 🛡 **Deine Daten, deine Maschine** — keine Telemetrie, kein SaaS-Vendor-Lock

## 🚀 Quick Start (VPS, ~20 Minuten)

> **Empfohlener Pfad:** ein günstiger VPS (Hetzner Cloud CX22 ≈ 4 €/Monat oder vergleichbar) mit Ubuntu 24.04 und einer Domain. Home-Server geht auch — siehe weiter unten.

### Phase 1 — Server provisionieren (lokal + Hetzner-Konsole)

1. SSH-Key erzeugen, falls du noch keinen hast:
   ```bash
   ssh-keygen -t ed25519 -C "deine-email@example.com" -f ~/.ssh/id_ed25519_lokyy
   ```
2. **Hetzner-Konsole** (oder dein bevorzugter Cloud-Provider):
   - Public-Key (`~/.ssh/id_ed25519_lokyy.pub`) hochladen
   - **Firewall** mit eingehend `22/tcp` (SSH), `80/tcp` (HTTP) und `443/tcp` (HTTPS) anlegen
   - Server bestellen: Ubuntu 24.04 LTS, CX22 (2 vCPU, 4 GB RAM, 40 GB SSD)
3. Server-IP notieren. Per SSH testweise einloggen: `ssh root@<server-ip>`

### Phase 2 — DNS-A-Record

Beim Domain-Registrar (Cloudflare, INWX, Namecheap …) drei A-Records auf die Server-IP zeigen lassen:

```
lokyy.deine-domain.de        →  <server-ip>
traefik.deine-domain.de      →  <server-ip>
hermes.deine-domain.de       →  <server-ip>
```

DNS-Propagation prüfen: `dig +short lokyy.deine-domain.de` — sollte deine Server-IP zurückgeben (5-30 min nach Anlage).

### Phase 3 — Server vorbereiten (Server, als sudo-fähiger User)

> Falls du nur einen `root`-Account hast: lege zuerst einen sudo-User an. Schnellrezept als root:
> ```bash
> adduser oliver
> usermod -aG sudo oliver
> rsync --archive --chown=oliver:oliver ~/.ssh /home/oliver
> ```
> Dann `exit` und neu einloggen: `ssh oliver@<server-ip>`.

```bash
# Repo klonen
git clone https://github.com/oliverhees/lokyy.git
cd lokyy

# Docker + Compose installieren (ein Befehl)
bash scripts/install-docker.sh

# Aus + wieder einloggen damit die docker-group greift
exit
ssh oliver@<server-ip>
cd lokyy
```

### Phase 4 — Lokyy installieren

```bash
bash scripts/install-lokyy.sh
```

Der Wizard fragt dich:

1. **Domain** — `lokyy.deine-domain.de`
2. **Email** für Let's-Encrypt-Zertifikate
3. **Traefik-Dashboard-Passwort** — frei wählbar, brauchst du selten
4. **LLM-Provider-Key** — OpenRouter, Anthropic ODER OpenAI (genau einen)

Was er macht:
- ✅ Alle internen Secrets per `openssl rand -hex 32` generieren
- ✅ `infrastructure/.env.local` mit `chmod 0600` schreiben
- ✅ Docker-Compose-Stack bauen (~5-10 min beim ersten Mal)
- ✅ Container hochfahren + auf `healthy` warten

### Phase 5 — Fertig

Browser öffnen → `https://lokyy.deine-domain.de` → **Registrieren** klicken → Email + Passwort wählen → das wird dein Lokyy-Admin-Account.

Du landest auf dem Dashboard. **Done.**

## 📋 Voraussetzungen

| | |
|---|---|
| **Server-OS** | Ubuntu 22.04 LTS oder 24.04 LTS (Debian 12 sollte gehen, ist aber nicht getestet) |
| **RAM** | min. 4 GB |
| **Disk** | min. 20 GB frei nach OS-Install |
| **Domain** | Eine Domain die du selbst kontrollierst (für Let's-Encrypt-Zertifikate) |
| **LLM-Provider-Key** | OpenRouter (Free-Tier verfügbar), Anthropic oder OpenAI — genau einen brauchst du |
| **Lokal** | `ssh`, `git` — sonst nichts |

## 🏠 Alternative: Home-Server / LAN-only

Wenn du keinen Cloud-Server willst, sondern auf einem Rechner zuhause hosten möchtest:

### Pfad A — Echte Domain mit Port-Forward
- Domain holen, DNS auf deine **öffentliche** IP zeigen lassen
- Im Router Port-Forward für `80` + `443` zur **lokalen IP** deines Servers
- Wizard genau wie oben — Let's-Encrypt holt sich das Zertifikat ganz normal
- DynDNS-Dienst (DuckDNS, no-ip) wenn dein ISP dynamische IPs gibt

### Pfad B — Tailscale (kein offenes Port, kein Public-DNS)
- [Tailscale](https://tailscale.com/) auf Server + Client installieren
- Server bekommt eine `*.ts.net` Adresse → die als `DOMAIN` im Wizard nutzen
- Zertifikate via Tailscale-Cert (`tailscale cert lokyy.deine-tailnet.ts.net`)
- Vorteil: nichts ist im Internet, du erreichst Lokyy nur aus dem Tailnet

### Pfad C — Lokal only (Test / Dev)
- Im Wizard `DOMAIN=lokyy.local` lassen (Default)
- Wizard schreibt `/etc/hosts`-Einträge wenn du `y` sagst
- Zertifikate sind self-signed → Browser warnt → akzeptieren
- Nur erreichbar **von der Maschine selbst**, nicht aus dem LAN

## 🗂 Second-Brain / Vault-Anbindung

**Geplant:** Lokyy bekommt sein eigenes Second-Brain via `lokyy-brain` (eigenen Hono-Service der gegen ein selbst-gehostetes [Forgejo](https://codeberg.org/forgejo/forgejo) als Markdown-Store schreibt). Das landet in einer der nächsten Phasen — bis dahin ist der `lokyy-brain` Container ein nginx-Placeholder.

**Heute (Übergang):** wenn du schon einen Obsidian-Vault hast, kannst du ihn read-only in Lokyy mounten:

1. In `infrastructure/docker-compose.yml` beim `lokyy-os-be`-Service den auskommentierten Volume-Mount aktivieren:
   ```yaml
   volumes:
     - lokyy-os-db:/app/data
     - /pfad/zu/deinem/obsidian-vault:/vault:ro
   ```
2. In `infrastructure/.env.local` setzen:
   ```
   LOKYY_VAULT_PATH=/vault
   ```
3. `docker compose --env-file .env.local up -d lokyy-os-be`

Im Menü unter **Vault** siehst du dann deine Markdown-Notes.

## 📡 Hermes mit Telegram / Discord / Slack verbinden

Hermes kann als Bot in Messaging-Plattformen agieren. Setup über die Hermes-CLI im laufenden Container:

```bash
docker exec -it lokyy-hermes /opt/hermes/.venv/bin/hermes gateway setup
```

Du wirst durch Token/Webhook-Config geführt. Nach erfolgreichem Setup taucht die Plattform unter **/channels** als "konfiguriert" auf.

## 🔧 Tägliche Bedienung

```bash
cd ~/lokyy/infrastructure

# Status
docker compose --env-file .env.local ps

# Logs (alles)
docker compose --env-file .env.local logs -f

# Logs nur Backend
docker compose --env-file .env.local logs -f lokyy-os-be

# Stoppen / Starten
docker compose --env-file .env.local stop
docker compose --env-file .env.local up -d

# Update auf neue Version
cd ~/lokyy
git pull
bash scripts/install-lokyy.sh   # idempotent — behält Secrets + Daten
```

## 🆘 Troubleshooting

### "https://lokyy.deine-domain.de antwortet nicht"

```bash
docker compose --env-file ~/lokyy/infrastructure/.env.local ps
```

Alle Container `healthy`? Wenn nicht → Logs des Übeltäters:

```bash
docker compose --env-file ~/lokyy/infrastructure/.env.local logs --tail 100 <containername>
```

Häufigste Ursachen:
- DNS zeigt noch nicht auf den Server (`dig +short lokyy.deine-domain.de`)
- Port 80 oder 443 ist nicht erreichbar (Hetzner-Firewall? lokale Firewall?)
- Let's-Encrypt-Rate-Limit (zu oft neu erstellt) → 1h warten

### "Chat antwortet nicht"

```bash
docker compose --env-file ~/lokyy/infrastructure/.env.local logs --tail 80 hermes
```

Häufige Ursachen:
- LLM-Provider-Key falsch / leer → `infrastructure/.env.local` öffnen, `OPENROUTER_API_KEY=` / `ANTHROPIC_API_KEY=` / `OPENAI_API_KEY=` prüfen
- Kein Guthaben beim Provider
- Outbound-Block (Firewall?) → `docker exec lokyy-hermes curl -fsSL https://openrouter.ai/api/v1/models | head` testen

### "Setup-Seite zeigt: 'Already configured'"

Du hast schon einen Owner-Account angelegt. Lokyy Personal ist single-tenant — eine Lokyy-Installation = ein User. Auf `/login` gehen und mit deinen Daten anmelden. Passwort vergessen? Schau im Backend-Container in `auth.db` nach (`docker exec lokyy-os-be sqlite3 /app/data/auth.db "SELECT email FROM user"`).

### "Container bleibt unhealthy"

```bash
docker compose --env-file ~/lokyy/infrastructure/.env.local ps
docker inspect --format='{{.State.Health.Log}}' <containername> | tail -3
```

### Komplett-Neustart von Null

```bash
cd ~/lokyy/infrastructure
docker compose --env-file .env.local down -v   # !!! löscht alle Daten !!!
cd ..
bash scripts/install-lokyy.sh
```

## 🗺️ Roadmap

- **Heute:** Auth · Chat · Tasks · Jobs (mit Cron-Runner) · Prompts · Teams · Workflows · Tools · Insights · Channels (Setup-CLI) · Integrations (curated list, OAuth in Phase-6) · Vault (Obsidian read-only)
- **Phase-3:** `lokyy-brain` als richtiges Second-Brain via Forgejo-Backend
- **Phase-5.5+:** User-creatable Agents, Skill-as-Workflow-Node, If/Else-Branching, Dashboard-Action-Slots
- **Phase-6:** OAuth-Flows für Integrations (Google Calendar, Gmail, Notion, Linear, Slack, GitHub)
- **Phase-9:** Multi-User mit user_id-Scoping (wenn das gewünscht wird — heute ist Single-Owner per Install)

## 📁 Was im Repo ist

```
lokyy/
├── README.md, LICENSE, NOTICE
├── scripts/
│   ├── install-docker.sh        ← Docker-Engine + Compose-Plugin
│   ├── install-lokyy.sh         ← Lokyy-Wizard (Secrets + Stack-Up)
│   └── verify-*.ts              ← Playwright-Healthchecks
├── infrastructure/
│   ├── docker-compose.yml       ← der ganze Stack (9 Container)
│   └── .env.example             ← Secret-Template
├── lokyy-app/                   ← Frontend (React 19 + TanStack Router + Tailwind 4)
├── lokyy-os-be/                 ← Backend (Bun + Hono + Better-Auth + sqlite)
└── lokyy-mcp/                   ← System-Bus + Cron-Scheduler
```

## 🙏 Credits

Lokyy steht auf den Schultern von:

- [**Hermes Agent**](https://github.com/NousResearch/hermes-agent) (Nous Research) — der LLM-Gateway + Tool-Runner, MIT
- [**Hermes Workspace**](https://github.com/outsourc-e/hermes-workspace) (Eric / outsourc-e) — ursprüngliches FE-Scaffold, MIT
- [**Better-Auth**](https://better-auth.com) — Auth-Layer, MIT
- [**TanStack Router**](https://tanstack.com/router), **Hono**, **Bun**, **Traefik**, **xyflow**

Lokyy wird gepflegt von Oliver Hees + Mitwirkenden — siehe [Contributors](https://github.com/oliverhees/lokyy/graphs/contributors).

## 📄 Lizenz

**[GNU AGPL-3.0-or-later](LICENSE).** Selbst-Hosten zur persönlichen Nutzung: erlaubt. Modifizieren: erlaubt. Als SaaS / Online-Service anbieten (auch eigene Forks): erlaubt, **aber** der Source-Code muss unter AGPL-3.0 verfügbar gemacht werden. Closed-Source-Einbau: nur via Dual-License-Vereinbarung.

Attribution + Third-Party-Lizenzen: [`NOTICE`](NOTICE).
