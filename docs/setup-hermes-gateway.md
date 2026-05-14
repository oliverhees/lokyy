# Setup — Hermes Agent Gateway für Lokyy-Workspace

> **Wann:** Wenn das Lokyy-Dashboard "Offline" / "Not available on this backend" zeigt.
> **Was passiert:** Workspace kommuniziert nicht mit Hermes Agent → keine Sessions, keine Skills, keine Jobs, kein Chat-Streaming.

---

## TL;DR

```bash
# 1. HTTP-API in Hermes-Config aktivieren (Brief-konform: opt-in)
echo 'API_SERVER_ENABLED=true' >> ~/.hermes/.env

# 2. Workspace sagt: Gateway ist auf Loopback
echo 'HERMES_API_URL=http://127.0.0.1:8642' >> /path/to/lokyy-workspace/.env

# 3. Gateway starten (oder replace)
hermes gateway run --replace

# 4. Verify
ss -tln | grep ':8642'   # → LISTEN
curl -fs http://127.0.0.1:8642/      # → 404 (ok — kein Root, aber HTTP up)

# 5. Workspace neu starten — er liest das neue .env nur beim Boot
pkill -f 'vite dev'
cd /path/to/lokyy-workspace && pnpm dev
```

Browser-Reload → Dashboard zeigt live-Stats + Provider-Status.

---

## Hintergrund — warum braucht es das

Der Hermes Agent Gateway ist defaultmäßig **opt-in** für die HTTP-API:

> The Hermes Agent gateway HTTP API server is opt-in. Add API_SERVER_ENABLED=true to ~/.hermes/.env and restart the gateway. Without it, the gateway serves messaging platforms but not port 8642.
> — `lokyy-workspace/.env.example`

Heißt: auch wenn `hermes gateway run` läuft, hört es ohne diese Env-Var auf Port 8642 NICHT. Die Workspace-React-App pollt aber genau diesen Port — daher "Offline"-Status auf jedem Backend-abhängigen Panel.

---

## Diagnose-Checklist

```bash
# Hermes CLI installiert?
which hermes && hermes --version

# Config existiert?
ls -la ~/.hermes/auth.json ~/.hermes/config.yaml

# Gateway-Prozess läuft?
hermes gateway status   # oder: pgrep -fa hermes

# API-Port listening?
ss -tln | grep ':8642'

# API_SERVER_ENABLED gesetzt?
grep API_SERVER_ENABLED ~/.hermes/.env

# Workspace kennt URL?
grep HERMES_API_URL /path/to/lokyy-workspace/.env
```

Wenn ein Punkt fehlt → entsprechenden Setup-Step nachholen.

---

## Häufige Fehlerfälle

### Gateway "läuft schon"
`hermes gateway run` meldet `❌ Gateway already running (PID ...)`. Lösung: `hermes gateway run --replace` ersetzt den bestehenden Prozess sauber.

### Gateway-Restart sagt "linger not enabled"
`hermes gateway restart` braucht systemd-User-Linger. Workaround ohne sudo: `hermes gateway run --replace`.

### Vite reagiert nicht auf neue ENV
Vite inlined `import.meta.env.*` zur Build-Zeit. Nach `.env`-Änderung **dev-server neu starten**, Browser-Reload reicht NICHT.

### Port 3000/3001/3002 belegt
Vite versucht der Reihe nach und nimmt den ersten freien — sieht im Log z.B. `Local: http://localhost:3003/`. Browser-URL entsprechend anpassen.

---

## Etappe-1-Kontext

Issue [#32](https://github.com/oliverhees/lokyy/issues/32) hat diese Doc ausgelöst. Vorher waren Dashboard-Stats + Backend-Unavailable-Cards permanent "Offline", obwohl Hermes installiert war — weil das Gateway zwar lief, aber ohne `API_SERVER_ENABLED`. Mit dem Fix oben rendert die App live.

Was das im Workspace freischaltet:
- **Dashboard:** Sessions, Tokens, API Calls, Active Model, Skills Usage
- **Chat:** SSE-Stream funktional, Tool-Calls werden gerendert
- **Jobs / Skills / MCP:** Card-Inhalte statt "Backend not available"
- **Conductor / Swarm:** Multi-Agent-Orchestration

Update-Notifier-Dialog ("Hermes updated") erscheint beim ersten Connect — zeigt Diff zu letztem bekannten Hermes-Agent-Commit.
