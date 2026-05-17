# ADR-007 — Heartbeat-Supervisor lebt als Container, nicht als systemd-Timer

- **Status:** accepted
- **Date:** 2026-05-16
- **Phase:** Phase-2b (Layer-3 Watchdog)
- **Issue:** #96

## Context

Phase-2b braucht einen Layer-3-Watchdog der Hermes liveness überwacht, Auto-Restart bei Crash/Hang fährt, und Missed-Cron-Recovery (z.B. Laptop-Sleep) handhabt. Drei Implementierungs-Optionen wurden erwogen:

1. **systemd-timer** auf dem Host
2. **Cron-job innerhalb von Hermes** (Hermes überwacht sich selbst)
3. **Eigener Container** im Lokyy-Stack

## Decision

Eigener Container `lokyy-supervisor`. Implementiert in Bun (passt zur restlichen Lokyy-Backend-Stack-Sprache), single-process tick-loop, kommuniziert über shared volume + docker-socket-proxy.

## Rationale

| Aspekt | systemd-timer | Hermes-self-check | Container |
|---|---|---|---|
| Identisch local/server | ✗ Host-spezifisch | ✓ | ✓ |
| Überlebt Hermes-Crash | ✓ | **✗ kritisch** | ✓ |
| Logs in der gleichen Surface | ✗ (journald) | ✓ | ✓ (docker logs) |
| Lokyy-Sprache (TS/Bun) | extra Shell-Layer | n/a | ✓ |
| Deploy-Komplexität | hoch (host-perm, systemd-units) | n/a | gering (compose service) |

Option 2 ist disqualifiziert weil der zu Überwachende sich nicht selbst überwachen kann (Liveness-Paradox). Option 1 koppelt an den Host-OS und bricht Server-Deploy auf Distros ohne systemd. Option 3 ist die einzige die alle Anforderungen erfüllt.

## Consequences

### Positive
- One stack, one log surface (`docker compose logs -f lokyy-supervisor`)
- Identisch zwischen `lokyy-installer install` local und server-deploy
- TypeScript-Code-Reuse: Activity-Log-Types shared mit lokyy-os-be

### Negative
- Container braucht docker-socket-Zugriff (via socket-proxy nur `containers:read`, `containers:start`) — Sicherheits-Surface dokumentieren
- Bei Reboot des Host-Docker-Daemons stirbt Supervisor mit dem Stack — Mitigation: `restart: unless-stopped` im compose

### Architectural alignment
Passt zur Phase-8 Doktrin "alles Docker-managed" (auch wenn Phase-8 noch nicht startet). Folgt ADR-003 (Docker-Topology Etappe-2).

## Communication channel: shared volume, not HTTP

Supervisor schreibt Activity-Events als JSONL-append in `/app/data/activity.jsonl` (shared volume `lokyy-os-db`, mounted in beiden Containern). lokyy-os-be liest beim API-Call.

**Warum nicht HTTP POST?**
- POSIX append <PIPE_BUF (4KB) ist atomisch — keine concurrent-write races
- Kein Auth-Token-Management für interne Service-zu-Service-Calls
- File-IO ist deterministisch in CI/Verifikation

**Warum nicht direkt Hermes pollen lassen, Activity-Log skippen?**
- Activity-Log ist UX-Surface (Bell + Panel im FE) — nicht nur Observability für Supervisor
- Audit-Trail über past Restarts wichtig für Phase-3 Debugging

## Out of scope for ADR-007

- Specialist-Subagent Heartbeats (ISC-76–80) — Phase-4 (Multi-Agent), eigenes ADR
- Cross-Service Notifications (Telegram, Email) — Phase-7 (Observability), eigenes ADR
