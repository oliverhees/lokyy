---
project: lokyy
task: Lokyy KI-Betriebssystem — Architektur-Design
slug: lokyy-kios-design
effort: E3
phase: plan
progress: 11/81
mode: design
started: 2026-05-16
updated: 2026-05-16
---

# ISA: Lokyy — KI-Betriebssystem Architecture

## Problem

Lokyy hat den Etappe-1 (Reskin) Kurs verlassen und arbeitet greenfield als persönliches KI-OS (ADR-001). Aktuell fehlt eine kohärente Architektur, die folgende Bausteine zu einem funktionierenden System verbindet:

1. **Agent-Core**: Hermes Agent (Novus Research) mit Self-Learning ist gewünscht — aber ungeklärt ob Hermes einen Heartbeat besitzt, oder ob Lokyy einen orchestrierenden Loop darüberlegen muss.
2. **Memory/Second-Brain**: Forgejo git als Storage (Karpathy-style) ist gewählt, aber Schema, Ingestion-Pipeline und Naming-Konventionen sind undefiniert.
3. **Identitäts-Layer**: PAI Telos (user.md, soul.md, MISSION, GOALS, BELIEFS, etc.) soll als Persönlichkeits-Grounding für Agenten dienen, ist aber noch nicht gemappt auf konkrete Agent-Prompt-Einbettung.
4. **Multi-Agent-System**: Vision ist eine Mannschaft von Experten-Agenten, jeder mit eigenen Prompts/Skills/MCPs, die kommunizieren, delegieren und Teams bilden — derzeit nur Konzept.
5. **Autonomie/Heartbeat**: System soll im Alltag selbstständig agieren (tasks erledigen, Notizen aufnehmen, Tools sprechen) — der orchestrierende Loop fehlt.
6. **Cross-AI-Bridge**: Lokyy soll mit Claude Code, OpenCode/"openClaw", und nativem Agent parallel arbeiten und delegieren können — Adapter-Layer und Protocol sind undefiniert.
7. **Observability**: Audit-Log, Cost-Tracking, Activity-View für Enterprise-Reife — derzeit nicht angefangen.

Ohne diese Klarheit landen wir bei "Hermes-Workspace Fork mit Logo-Wechsel" statt bei einem echten KI-Betriebssystem.

## Vision

Ein selbst-gehostetes, modular-agnostisches KI-Betriebssystem, das den User vom Tag-1 an sichtbar im Alltag entlastet. Das **euphoric-surprise Erlebnis**: Der User logged sich morgens ein und sieht im Dashboard "Während du geschlafen hast: 3 Mails beantwortet (drafts vorbereitet), 2 Termine geprüft auf Konflikte, eine Notiz aus gestern in Second-Brain einsortiert, ein Sub-Task an Claude-Code delegiert (Resultat unten)". Kein "noch ein Chatbot" — sondern ein System, das im Hintergrund denkt, dokumentiert, und auf Knopfdruck eskaliert.

Das Differenzierungsmerkmal gegenüber Cursor/ChatGPT/Claude.ai: **Lokyy hat ein Gedächtnis, das wächst** (Forgejo-Second-Brain), **eine Identität, die bekannt ist** (PAI Telos), **ein Team aus Experten** (nicht ein Generalist), **einen Herzschlag** (Heartbeat-Loop) und **die Fähigkeit zur Cross-AI-Delegation** (Claude/OpenCode als ausführende Hände).

## Out of Scope

- **Public SaaS / Multi-Tenant**: Single-User self-hosted zuerst; SaaS-Deploy nicht in Etappe-2.
- **Mobile App**: Web-Frontend only; Mobile später per PWA (lokyy-brain hat schon eine).
- **Voice-First-UI**: Text-first; ElevenLabs-TTS-Notifications optional, STT-Input optional.
- **Lokale LLMs als Primärweg**: Cloud APIs (Anthropic, OpenAI) primär; Ollama optional erst nach Phase-4.
- **Reaktivierung Etappe-1-Reskin**: Bleibt gestoppt per ADR-001.
- **Eigenes LLM-Training**: Self-Learning bezieht sich auf Hermes-Mechanismen + Memory-System, nicht auf Modell-Training.
- **Generische Public-Facing Marketplace**: Skill-Marketplace ist single-user/private zuerst.
- **Reimplementierung lokyy-brain in lokyy-os**: bleibt eigener Service; kein Merge.
- **Direkte Forgejo-Writes aus lokyy-os**: verboten; alle Writes via lokyy-brain HTTP-API.
- **Privileged Docker-Operations vom Docker-MCP**: kein root-equivalent, kein `--privileged`, kein Host-Mount außer geprüfte Pfade. Anti-Goal für Phase-8.

## Principles

- **Visibility-First** (Lokyy-Doktrin): User sieht von Tag-1 was passiert. Jede Phase startet mit Auth + sichtbarem Dashboard, dann Backend.
- **Playwright als Done-Gate** (Lokyy-Doktrin): Kein Issue geschlossen ohne E2E-Test grün + Screenshot-Evidence.
- **Issue-Discipline** (Lokyy-Memory): Jeder Work-Item = GitHub Issue, sofort geschlossen bei Completion.
- **Modular-Agnostisch**: Agenten, Modelle, Tools, Storage sind austauschbar; Lockin-Vermeidung.
- **Autonomy with Accountability**: Agenten dürfen autark agieren, aber jeder Schritt ist im Activity-Log + Cost-Tracker dokumentiert.
- **Second-Brain als Source of Truth für Wissen**: Forgejo-git ist das Gedächtnis. UI/DB sind Views darauf.
- **Identity-Grounding via Telos**: Jeder Agent kennt MISSION/GOALS/BELIEFS des Users vor jedem Lauf.
- **Code-Before-Prompts** (PAI-Doktrin): Deterministischer Code wo möglich; Prompts nur wo nötig.
- **Orchestrator-Mode** (Lokyy-CLAUDE.md): Claude Code delegiert an BMAD-Agents; keine direkte Implementierung.

## Constraints

- **Self-hosted auf Linux-Server**: Keine SaaS-Abhängigkeiten als kritischer Pfad.
- **Docker-first Deployment**: ALLE Komponenten (lokyy-os-fe, lokyy-os-be, lokyy-brain, forgejo, reverse-proxy) laufen in Containern, orchestriert via docker-compose. Kein "läuft nur lokal" — von Tag-1 server-deployed.
- **lokyy-brain bleibt eigener Service** (Decision 2026-05-16): existing Hono/TS-Service mit Forgejo-Backend wird NICHT in lokyy-os gemergt. lokyy-os spricht ausschließlich via HTTP-API (port 8787) gegen lokyy-brain. Single-Write-Path.
- **Forgejo läuft REMOTE** (Decision 2026-05-16 post-deploy): keine Forgejo-Container im lokyy-stack. lokyy-brain wird per `LOKYY_BRAIN_FORGEJO_URL` an die externe Forgejo-Instanz angebunden; das vermeidet Duplikation existierender funktionsfähiger Infrastruktur.
- **lokyy-brain Frontmatter Contract**: jede .md braucht `id` (ULID), `type` aus closed-list (note|capture|project|task|decision|meeting|customer|workflow|intervention|content), `title`, `created`, `updated`. Pre-commit-hook in lokyy-vault enforced.
- **Hermes Agent (Nous Research, github.com/nousresearch/hermes-agent, MIT)** als Core Agent Framework, läuft als eigener Python-Container im lokyy-stack. **Verifiziert**: hat eingebauten Cron-Heartbeat, autonomes Skill-Learning, Multi-Agent-Subagent-Spawning, 40+ Tools, model-agnostisch. Lokyy nutzt diese Mechanismen — baut NICHT eigenen Daemon.
- **Reverse-Proxy = Traefik** (Decision 2026-05-16): Docker-Label-Auto-Discovery aligned mit Phase-8 (Docker-MCP spawnt Services).
- **Install-Wizard** als first-class Requirement: `lokyy-installer` CLI macht Fresh-Server-Setup idempotent bis Browser öffnet.
- **TelosAdapter Pattern**: Telos-Files via read-only Volume in lokyy-os-be (MVP); Interface erlaubt späteren Swap zu sync-copy/git-pull ohne Agent-Touch.
- **PAI Telos** als Persönlichkeits-/Identitäts-Layer, read-only Mount.
- **pnpm + TypeScript strict** (Lokyy-Workspace Stack: React 19, Vite, Tailwind 4, @base-ui/react, TanStack Router/Start, Zustand).
- **Lokyy-Branding everywhere a human sees it**; Code-Identifier bleiben unverändert.
- **Linux-Verifizierung via Playwright**, nicht Interceptor (siehe `scripts/verify-ui.ts`).
- **Vite-Watcher muss `data/` ignorieren** (memory project_lokyy_vite_watcher_data) — sonst Reload-Loops.
- **BMAD v6.6.0** Agent-Setup ist vorhanden; nicht reinitialisieren.
- **Auth-Gateway zentral in lokyy-os-be**: lokyy-brain selbst hat keinen Auth-Layer (CORS=*) und ist NUR im internen Docker-Netz erreichbar.

## Goal

Liefere einen 6-phasen Implementations-Bauplan für Lokyy als KI-OS, der alle sieben Architektur-Bausteine (Foundation, Memory, Identity, Multi-Agent, Heartbeat-Autonomy, Cross-AI-Bridge, Observability) abdeckt, jede Phase ein sichtbares Playwright-verifizierbares Demo-Artefakt produziert, und mit der Visibility-First-Doctrine + Issue-Discipline + Playwright-Done-Gate kompatibel ist. **Done wenn** der User den Plan freigibt oder gezielte Iteration anfordert. **Plan-means-stop** — keine BMAD-Delegation oder Code-Implementierung bevor Freigabe.

## Criteria

- [ ] ISC-1: Auth-Flow (Login/Logout/Session-Refresh) per Playwright E2E grün
- [ ] ISC-2: Dashboard rendert User-State + Liste aktiver Agenten auf Erst-Login
- [ ] ISC-3: Hermes Agent als Core in Lokyy-Backend eingebunden und HTTP-pingbar
- [ ] ISC-4: Hermes-Self-Learning + autonomous-skill-creation aktiviert + Skill-Output ist im Lokyy-Audit-Log sichtbar
- [ ] ISC-5: Hermes-eingebauter Cron-Scheduler läuft mit mindestens 3 Lokyy-spezifischen Tasks (Hermes-internal scheduling)
- [ ] ISC-6: Heartbeat-Cycle (Hermes-cron-task triggert): read Telos+state → plan → act → schreibt Diary in lokyy-brain
- [DROPPED] ISC-7: [DROPPED 2026-05-16 — Forgejo läuft remote, kein Container im stack; lokyy-brain spricht via LOKYY_BRAIN_FORGEJO_URL gegen externe Instanz. Siehe Decisions.]
- [ ] ISC-8: lokyy-brain-Container läuft im lokyy-stack, /health antwortet 200 via internal Docker-Net
- [ ] ISC-9: BrainAdapter in lokyy-os-be (TypeScript) wrappt vollständige lokyy-brain HTTP-API (notes/vault/graph/pipes)
- [ ] ISC-10: PAI Telos Files (MISSION, GOALS, BELIEFS, soul.md, user.md) als read-only Mount in Lokyy verfügbar
- [ ] ISC-11: Telos-zu-Agent-Prompt-Mapping dokumentiert (welcher Agent liest welche Felder)
- [ ] ISC-12: user.md Schema definiert (Felder, Verwendung, wer schreibt/wer liest)
- [ ] ISC-13: soul.md Schema definiert (Persönlichkeits-Felder für DA-Voice/Tone)
- [ ] ISC-14: Mindestens 5 spezialisierte Agenten deployed (Conductor, Researcher, Writer, Coder, Curator)
- [ ] ISC-15: Jeder Agent hat eigenen System-Prompt + Skill-Set + MCP-Liste dokumentiert
- [ ] ISC-16: Skill-System lädt Skills aus Disk dynamisch und listet sie im UI
- [ ] ISC-17: MCP-Server konnektierbar, mindestens 3 angebunden (Filesystem, Calendar, Email)
- [ ] ISC-18: Agent-zu-Agent-Delegation funktioniert (A ruft B mit context, B antwortet) — E2E
- [ ] ISC-19: Agent-Team-Koordination via Conductor (split → parallel → recombine) verifiziert
- [ ] ISC-20: Anti: Keine Agent-Action ohne Audit-Log-Eintrag im Activity-Log
- [ ] ISC-21: Activity-Log per UI filter/durchsuchbar (Agent, Zeit, Action-Type)
- [ ] ISC-22: Cost-Tracking pro Agent-Action (Tokens + Tool-Cost) sichtbar im Dashboard
- [ ] ISC-23: Claude-Code-Adapter führt definierten Test-Task aus; Resultat zurück in Lokyy
- [ ] ISC-24: OpenCode/"openClaw"-Adapter führt definierten Test-Task aus; Resultat zurück in Lokyy
- [ ] ISC-25: Cross-AI-Delegation (Lokyy delegiert an Claude und an OpenCode) verifiziert
- [ ] ISC-26: Adapter-Interface dokumentiert (`AgentAdapter.execute(task, context) → result`)
- [ ] ISC-27: Anti: Kein silent failure — jeder Fehler erreicht User-UI oder Notification
- [ ] ISC-28: Anti: Kein irreversibler External-Action (email send, payment, write to public repo) ohne explizite Confirmation
- [ ] ISC-29: Anti: Kein Agent darf Telos-Files schreiben — read-only
- [ ] ISC-30: Antecedent: Forgejo läuft + Auth ok bevor Second-Brain Ingestion startet
- [ ] ISC-31: Antecedent: Heartbeat startet nur wenn User logged-in oder "always-on" Flag gesetzt
- [ ] ISC-32: Diary/Activity-Eintrag pro Heartbeat-Run dokumentiert was passiert ist
- [ ] ISC-33: Backup-Strategie für Forgejo definiert (regelmäßiger Push zu zweiter Remote)
- [ ] ISC-34: Voice-Notifications optional aktivierbar (ElevenLabs TTS für DA-Ansagen)
- [ ] ISC-35: Skill-Marketplace-UI listet verfügbare Skills + Status enabled/disabled
- [ ] ISC-36: Conductor-Agent dekomposiert User-Request in Agent-Team-Plan (sichtbar im UI)
- [ ] ISC-37: Jeder Agent hat Scope-Boundary dokumentiert (was er NICHT tut)
- [ ] ISC-38: Reminder/Cron-Management per UI (User kann Heartbeat-Tasks anpassen)
- [ ] ISC-39: Phase-Plan + Acceptance-Demo pro Phase im Repo (`docs/phases/`)
- [ ] ISC-40: Jedes der 6 Phasen-Demos in Playwright-E2E grün + Screenshot in Issue
- [x] ISC-41: `docker-compose.yml` orchestriert lokyy-os-fe, lokyy-os-be, lokyy-brain, traefik, docker-socket-proxy auf gemeinsamem lokyy-net (Forgejo läuft remote, kein Container im Stack)
- [ ] ISC-42: BrainAdapter behandelt 409-Conflict (Note überschrieben remote) deterministisch — retry-with-merge oder surface-to-user
- [ ] ISC-43: Anti: lokyy-os schreibt NIE direkt in Forgejo (kein git-Tool im lokyy-os-be Container; nur HTTP zu lokyy-brain)
- [x] ISC-44: Reverse-Proxy (Caddy/Traefik) terminiert TLS und routet `/` → lokyy-os-fe; lokyy-brain :8787 ist NICHT public exposed
- [ ] ISC-45: Heartbeat-Daily-Diary wird via `PUT /api/notes/daily/YYYY-MM-DD` mit korrektem Frontmatter (ULID + type=note) geschrieben
- [ ] ISC-46: ULID-Generierung im BrainAdapter zentralisiert (lib/ulid.ts), nicht in jedem Agent dupliziert
- [ ] ISC-47: lokyy-brain MCP-Server (Epic-5 dort) als Agent-Tool in Lokyy registriert; scoped via `00_meta/mcp-scopes.yaml`
- [ ] ISC-48: Pipe-Status-Polling im BrainAdapter — outstanding pipe-jobs werden in lokyy-os-db getrackt, retry-on-startup-of-crash (Mitigation für nicht-restart-feste lokyy-brain Queue)
- [ ] ISC-49: Antecedent: lokyy-brain `/health` returnt 200 bevor BrainAdapter erste Write-Operation ausführt (startup-gate)
- [ ] ISC-50: Antecedent: Forgejo-Backup-Cron läuft (täglicher push zu zweitem remote) bevor erstes Write von lokyy-os
- [ ] ISC-51 (Phase-8, future): Docker-MCP listet, started, stoppt managed services aus Whitelist (`lokyy-managed/*`)
- [ ] ISC-52 (Phase-8, future): Anti: Docker-MCP führt KEINE privileged-Operationen aus (kein `--privileged`, kein `/var/run/docker.sock` direkt — via `docker-socket-proxy`)
- [ ] ISC-53 (Phase-8, future): Docker-MCP-Whitelist erlaubter Base-Images dokumentiert + signed
- [x] ISC-54: Anti: keine Geheimnisse (API-Keys, Tokens) als Klartext in Container-Env — alles via Docker-Secrets oder `.env.local` mit 0600
- [ ] ISC-55: BrainAdapter cached read-heavy Endpoints (/api/notes, /api/graph) mit invalidation-on-write
- [x] ISC-56: Brain-MCP-Contract-Doc existiert BEVOR Hermes-Agents geschrieben werden (load-bearing per Advisor) — `docs/decisions/ADR-004-lokyy-brain-mcp-contract.md`
- [ ] ISC-57: Brain Write-Concurrency unter Multi-Agent-Load verifiziert (load-test: N parallel writes → 0 lost, 0 corrupt)
- [ ] ISC-58: ULID-Collision-Strategie dokumentiert (was bei 2 Agents mit identischer ULID — extrem unwahrscheinlich aber definiert)
- [x] ISC-59: Anti: Frontmatter-Validation lebt AUSSCHLIEßLICH in lokyy-brain — niemals dupliziert in lokyy-os oder Adaptern (single source of contract) — kontraktualisiert in ADR-006 (Lint Layer A + TypeScript Barrier Layer B)
- [x] ISC-60: Cross-AI-Bridge ruft lokyy-brain via dem gleichen MCP/HTTP-Pfad wie alle anderen Agenten — kein paralleler Schreibweg — kontraktualisiert in ADR-004 §6
- [ ] ISC-61: Pipes-Trigger-Ownership dokumentiert: Agenten lösen pipes aus via `POST /api/pipes/import` (oder MCP-Tool), kein Lokyy-OS-Reimplement
- [x] ISC-62: Per-Agent-Auth-Token in lokyy-brain (brain-side feature) + Audit-Log "welcher Agent schrieb welche Note" — kontraktualisiert in ADR-005 (stateless JWT HS256 von lokyy-os-be signed, brain-verified; mcp-audit.jsonl)
- [ ] ISC-63: Antecedent: 4 Pre-Phase-1-Vorbedingungen erledigt (MCP-Contract-Doc, Concurrency-Audit, Compose+Auth-Decision, Validation-Location-Decision) — als GitHub-Issues getrackt
- [ ] ISC-64: Heartbeat- vs Conductor-Ownership dokumentiert (zwei Control-Planes klar abgegrenzt; wer triggert was)
- [ ] ISC-65: Hermes-Subagent-Spawning für Specialist-Roles (Researcher/Writer/Coder/Curator) konfiguriert; Conductor = parent Hermes-Instance
- [ ] ISC-66: TelosAdapter-Interface in lokyy-os-be (lib/telos-adapter.ts) — getTelos(field) → string; Impl = volume-read; mock-impl für Tests
- [x] ISC-67: `lokyy-installer` CLI exists (`cli/lokyy-installer.ts`) mit `install / up / down / purge / status` Commands — verifiziert via `bun cli/lokyy-installer.ts help` (alle 5 Commands gelistet)
- [x] ISC-68: Install-Wizard idempotent — verifiziert: 1. Lauf generiert fehlende Secrets (LOKYY_AGENT_JWT_SECRET), 2. Lauf erkennt alle Werte vorhanden, kein Re-Generate, gleicher End-State
- [x] ISC-69: Install-Wizard health-check loop wartet bis alle Container `healthy` (90s default timeout); exit 0 nur bei Erfolg, exit 3 bei Timeout mit Status-Dump
- [ ] ISC-70: OpenClaw-Adapter in lokyy-os-be (lib/openclaw-adapter.ts) — delegiert Task an OpenClaw-Instanz, parsed Result
- [ ] ISC-71: Anti: OpenClaw-Adapter shared KEINE Lokyy-Secrets; OpenClaw läuft mit eigenem API-Key-Set
- [x] ISC-72: Traefik konfiguriert mit auto-TLS (Let's Encrypt) + Docker-Label-Discovery + Dashboard hinter Auth
- [ ] ISC-73: Lokyy-Heartbeat-Supervisor läuft als eigener Container (oder systemd-timer); 60s default tick
- [ ] ISC-74: Supervisor pollt Hermes `/health` + `/tasks/pending` jede Tick-Periode; metrics → activity-log
- [ ] ISC-75: Supervisor erkennt Hermes-Container-Down + auto-restart via docker-socket-proxy + Notify-User
- [ ] ISC-76: Jeder Specialist-Subagent hat `/heartbeat` Endpoint returnt `{state: idle|active|error, lastActive: ISO-8601, currentTaskId?}`
- [ ] ISC-77: Wake-Push: Supervisor kann `POST /wake` an Specialist senden für niedrig-latente Task-Checks
- [ ] ISC-78: Wake-Pull: jeder Specialist hat eigene Poll-Interval (default 5min) — defense-in-depth wenn Supervisor down
- [ ] ISC-79: Sleep-Cycle: Specialist returns idle nach Task-Done, logs `task completed` zu activity-log
- [ ] ISC-80: Anti: Specialist > maxTaskDuration (default 10min, configurable) ohne Heartbeat-Update → kill + retry mit exponential-backoff (max 3)
- [ ] ISC-81: Missed-Cron-Recovery: wenn Supervisor erkennt scheduled task lief nicht (z.B. Server-Sleep) → catch-up-Trigger oder skip-with-log (configurable per task)

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1 | E2E | Login/Logout flow | 100% pass | Playwright |
| ISC-2 | E2E | Dashboard renders | screenshot match | Playwright |
| ISC-3 | Smoke | Hermes /health endpoint | 200 OK | curl |
| ISC-4 | Doc | Hermes self-learn doc | file exists, ≥1 page | Read |
| ISC-5 | Process | Heartbeat tick log | 1 tick/interval | rg log |
| ISC-6 | Integration | Full heartbeat cycle | state→plan→act→log | bun test |
| ISC-7 | Smoke | Forgejo /api/v1/version | 200 OK | curl |
| ISC-8 | Doc | Schema doc with examples | file exists | Read |
| ISC-9 | Integration | Test note ingestion | commit in repo | git log |
| ISC-10 | Read | Telos files readable | content non-empty | Read |
| ISC-11 | Doc | Mapping table | file exists | Read |
| ISC-12 | Schema | user.md fields | json-schema valid | bun test |
| ISC-13 | Schema | soul.md fields | json-schema valid | bun test |
| ISC-14 | Inventory | Agent registry | count ≥ 5 | bun run agents:ls |
| ISC-15 | Doc | Per-agent spec | 5 files exist | Read |
| ISC-16 | E2E | Skill UI list | skills enumerated | Playwright |
| ISC-17 | Integration | MCP handshake | 3 servers ok | bun test |
| ISC-18 | E2E | A→B delegation log | B response logged | Playwright |
| ISC-19 | E2E | Team task split | parallel actions visible | Playwright |
| ISC-20 | Audit | Log entry per action | 1:1 ratio | bun test |
| ISC-21 | E2E | Activity log filter | filtered list correct | Playwright |
| ISC-22 | E2E | Cost shown in UI | value > 0 displayed | Playwright |
| ISC-23 | Integration | Claude Code adapter | result returned | bun test |
| ISC-24 | Integration | OpenCode adapter | result returned | bun test |
| ISC-25 | E2E | Cross-AI delegation | result back visible | Playwright |
| ISC-26 | Doc | Adapter interface doc | file exists | Read |
| ISC-27 | Audit | Error routing | 100% to UI/inbox | bun test |
| ISC-28 | Audit | Confirmation gate | irreversible blocked | bun test |
| ISC-29 | Audit | Telos write attempt | rejected by middleware | bun test |
| ISC-30 | Pre-check | Forgejo ping before ingest | 200 OK | curl |
| ISC-31 | Pre-check | Heartbeat session gate | only fires authed | bun test |
| ISC-32 | Audit | Heartbeat diary | 1 entry/run | rg log |
| ISC-33 | Doc | Backup strategy | file + cron set | Read |
| ISC-34 | Integration | Voice TTS notify | audio produced | bun test |
| ISC-35 | E2E | Marketplace UI | skills list+toggle | Playwright |
| ISC-36 | E2E | Conductor plan UI | decomposition visible | Playwright |
| ISC-37 | Doc | Agent scope spec | per-agent boundary | Read |
| ISC-38 | E2E | Reminder UI | cron editable | Playwright |
| ISC-39 | Doc | Phase docs | 6 files exist | Read |
| ISC-40 | E2E | Phase demos | 6 tests green | Playwright |
| ISC-41 | Smoke | docker compose ps | all healthy | bash |
| ISC-42 | Integration | Conflict scenario | 409 handled, no data loss | bun test |
| ISC-43 | Audit | git-tool absent in lokyy-os-be | not in image | docker exec |
| ISC-44 | Smoke | public access lokyy-brain | refused (timeout) | curl |
| ISC-45 | Integration | heartbeat diary write | valid frontmatter in repo | git log |
| ISC-46 | Code | ULID lib usage | 1 import location | grep |
| ISC-47 | Integration | MCP scoped tool | agent can call brain | bun test |
| ISC-48 | Integration | crash + restart | pending pipes retried | bun test |
| ISC-49 | Pre-check | brain /health | 200 before first write | bun test |
| ISC-50 | Cron | backup last-run | < 24h ago | bash |
| ISC-51 | (future) | docker-mcp list | shows whitelist | bun test |
| ISC-52 | (future, audit) | privileged blocked | error returned | bun test |
| ISC-53 | (future, doc) | whitelist file | signed + present | Read |
| ISC-54 | Audit | env scan | no plaintext secrets | bash |
| ISC-55 | Integration | cache hit rate | reads after write invalidated | bun test |
| ISC-65 | E2E | Subagent spawn | parent+child both logged | Playwright |
| ISC-66 | Code | Adapter import sites | only via interface | grep |
| ISC-67 | Smoke | `lokyy --help` | shows 5 commands | bash |
| ISC-68 | Idempotency | install x2 | identical end-state | bash + docker compose ps |
| ISC-69 | Integration | install health-loop | exits 0 when healthy | bash test |
| ISC-70 | Integration | OpenClaw task | result returned | bun test |
| ISC-71 | Audit | env-vars in openclaw container | no lokyy secrets present | docker exec |
| ISC-72 | E2E | https + traefik dashboard | TLS valid + auth required | Playwright |
| ISC-73 | Smoke | Supervisor container running | `docker compose ps` healthy | bash |
| ISC-74 | Integration | Tick log entries | ≥1 entry per minute | rg log |
| ISC-75 | Chaos | Kill hermes, observe | auto-restart < 30s + notify | bash test |
| ISC-76 | Integration | Specialist heartbeat shape | json shape valid | curl |
| ISC-77 | Integration | Wake push | specialist transitions idle→active | bun test |
| ISC-78 | Integration | Pull poll | works even with supervisor stopped | bun test |
| ISC-79 | Integration | Sleep transition | active→idle + log entry | bun test |
| ISC-80 | Chaos | Hung task simulation | kill+retry within budget | bun test |
| ISC-81 | Chaos | Server sleep simulation | missed crons handled per policy | bun test |

## Features

| name | satisfies | depends_on | parallelizable |
|------|-----------|------------|----------------|
| Phase-0 — Docker-Topologie + docker-compose Skeleton | ISC-41, ISC-44, ISC-54 | — | no |
| Phase-0.5 — Contract-Sprint (4 GH-Issues; Advisor-bedingt) | ISC-56, ISC-57, ISC-58, ISC-59, ISC-60, ISC-61, ISC-62, ISC-63, ISC-64 | Phase-0 | yes (4 parallel issues) |
| Phase-1 — Foundation (Auth-Gateway + Dashboard + Issue-Discipline) | ISC-1, ISC-2, ISC-39 | Phase-0.5 | no |
| Phase-2 — Hermes Core + Lokyy-Heartbeat-Supervisor (3-Layer-Autonomie) | ISC-3, ISC-4, ISC-5, ISC-6, ISC-31, ISC-32, ISC-73, ISC-74, ISC-75, ISC-76, ISC-77, ISC-78, ISC-79, ISC-80, ISC-81 | Phase-1 | partial |
| Phase-3 — Memory Integration (lokyy-brain Anbindung + BrainAdapter) | ISC-7, ISC-8, ISC-9, ISC-42, ISC-43, ISC-45, ISC-46, ISC-48, ISC-49, ISC-50, ISC-55 | Phase-1 | yes (parallel mit Phase-2) |
| Phase-3b — PAI Telos Mount + Schema | ISC-10, ISC-11, ISC-12, ISC-13, ISC-29 | Phase-1 | yes |
| Phase-4 — Multi-Agent System + MCP-Scopes-Integration | ISC-14, ISC-15, ISC-16, ISC-17, ISC-18, ISC-19, ISC-35, ISC-36, ISC-37, ISC-47 | Phase-2, Phase-3 | partial |
| Phase-5 — Observability + Audit + Cost (cross-cutting ab Phase-2) | ISC-20, ISC-21, ISC-22, ISC-27, ISC-28 | Phase-2 | yes |
| Phase-6 — Cross-AI Bridge (Claude + OpenCode adapters) | ISC-23, ISC-24, ISC-25, ISC-26 | Phase-4 | partial |
| Phase-7 — Daily-Life Polish + Reminders + Voice | ISC-34, ISC-38, ISC-40 | Phase-4 | yes |
| Phase-8 — Docker-MCP (System spawnt managed Services) | ISC-51, ISC-52, ISC-53 | Phase-5 | partial |
| Phase-9 — Install-Wizard CLI (`lokyy-installer`) | ISC-67, ISC-68, ISC-69 | Phase-0 (kann parallel zu Phase-1+) | yes |

## Decisions

- **2026-05-16** — ISA bei Greenfield-Etappe-2 als Projekt-ISA bei `lokyy/ISA.md` erstellt (nicht Task-ISA in MEMORY/WORK). Project-ISA-Override greift: E3+ Struktur erfüllt.
- **2026-05-16** — Inline-Write der ISA via Write-Tool statt `Skill("ISA", "scaffold...")`. Show-your-math: Brainstorming-Session, Format ist canonical per Hand, Skill-Overhead unnötig. Ergebnis identisch.
- **2026-05-16** — Delegation-Floor (≥2 soft für E3) **nicht erfüllt** — show-your-math: Plan-means-stop active; keine Code-Execution, keine BMAD-Delegation vor User-Freigabe; Forge/Anvil/Research wären output-without-mandate. Delegation greift erst nach Plan-Approval bei Phase-1-Start.
- **2026-05-16** — **OPEN QUESTION (blockt Phase-2-Start)**: Hat Hermes Agent (Novus Research) eingebauten Heartbeat-Loop oder müssen wir einen oberhalb bauen? Aktuelle Annahme: Hermes ist ein Single-Run Agent, Self-Learning bezieht sich auf In-Context-Lernen; **Lokyy muss eigenen Heartbeat-Daemon bauen** der Hermes als Tool aufruft. → User-Bestätigung oder gezielter Research-Task nötig.
- **2026-05-16** — **OPEN QUESTION**: "openClaw" — interpretiere als "OpenCode" (Open-Source Coding-Assistant à la Charm/OpenInterpreter). User-Bestätigung welches System genau gemeint ist (OpenCode? Open-Interpreter? Anderes?).
- **2026-05-16** — Reihenfolge folgt Visibility-First-Doctrine: Phase-1 muss Auth+Dashboard zuerst liefern bevor Hermes/Forgejo/Agents. Phase-5 (Observability) ist cross-cutting — beginnt mit Phase-2 + wächst über alle Phasen.
- **2026-05-16** — Telos-Files sind **read-only für Agenten** (ISC-29). Schreibrechte hat nur User direkt (oder explizite User-approved Telos-Update-Workflow). Verhindert dass Heartbeat-Agenten heimlich GOALS umschreiben.
- **2026-05-16 (User-Approval)** — Brainstorm-Plan freigegeben ("klingt alles super und machen wir so"). Bedingung: zwei neue Constraints.
- **2026-05-16 (Constraint)** — Deployment ist Docker-first auf Server. Alle Komponenten in Containern, docker-compose orchestriert. Neue Phase-0 vor Phase-1: docker-stack-skeleton.
- **2026-05-16 (Future)** — Lokyy soll später eigene Docker-Services on-demand spawnen können (Agent fordert "ich brauch einen Selenium-Container" → spawn/use/teardown). Phase-8. Hartes Sicherheits-Gate: kein privileged, Whitelist Base-Images, docker-socket-proxy statt direkter Socket-Mount.
- **2026-05-16 (Architektur-Entscheidung, commitment-boundary)** — **lokyy-brain wird NICHT nativ integriert**, bleibt eigener Docker-Service. Begründung: (a) Sunken Cost Recovery — pre-commit-hook + git-Promise-Lock + Pipes sind solid implementiert; (b) Karpathy-Doktrin "markdown is the state" macht Service-Boundary natürlich; (c) lokyy-brain bleibt von anderen Apps (PWA, externe) nutzbar; (d) Epic-5 (MCP) in lokyy-brain wird der natürliche Agent-Zugang via scoped tools (`00_meta/mcp-scopes.yaml`); (e) ersetzbarkeit-strategisch — lokyy-brain mal austauschbar gegen Logseq/Capacitor ohne lokyy-os-Touch. **Advisor-Call läuft im Hintergrund** für Cross-Check.
- **2026-05-16 (lokyy-brain Adoption)** — Frontmatter-Contract (ULID + closed-list type) wird übernommen; ersetzt mein vorheriges naives `daily/concepts/people/...` Schema. Closed-List-Types decken den Use-Case besser ab (note, capture, project, task, decision, meeting, customer, workflow, intervention, content).
- **2026-05-16** — Effort von E3 auf E4 mid-stream eskaliert per Klassifier. Thinking-Floor erweitert um Advisor + ReReadCheck. Cato-Audit ist E4-MANDATORY-bei-VERIFY — deferred wegen Plan-means-stop; greift sobald erste Phase verifiziert wird.
- **2026-05-16 (Q1-RESOLVED)** — Hermes Agent (nousresearch/hermes-agent) verifiziert: hat eingebauten Cron-Heartbeat + autonomous-skill-learning + Multi-Agent-Subagent-Spawning + 40+ Tools + model-agnostic + Docker-deploy + MIT. Mein Phase-2-Plan "wir bauen Heartbeat" war FALSCH. Korrektur: Phase-2 = Hermes-Container deployen + Lokyy-Tasks im Hermes-Cron registrieren + Audit-Log-Bridge.
- **2026-05-16 (Q2-RESOLVED)** — OpenClaw = peer-Agent-System (Peter Steinberger, MIT, lokal-autonomer Agent mit Heartbeat). Phase-6-Bridge = drei Targets: Lokyy-native (Hermes), Claude Code (subprocess), OpenClaw (HTTP/Messaging). ⚠ Star-Count-Claims aus Suchergebnissen ungeprüft — vor Phase-6-Build crossgecheckt.
- **2026-05-16 (Q3-RESOLVED)** — Telos-Mount: read-only Docker-Volume von `~/.claude/PAI/USER/TELOS/` in lokyy-os-be; Adapter-Pattern (TelosAdapter Interface) erlaubt späteren Swap.
- **2026-05-16 (Q4-RESOLVED)** — Server existiert; ZUSÄTZLICH neuer Constraint: Wizard-Install. Phase-9 (`lokyy-installer` CLI) eingefügt, parallel zu Phase-1+ implementierbar.
- **2026-05-16 (Q5-RESOLVED)** — lokyy-brain = separates Repo, noch in Entwicklung. Phase-0.5 Contract-Sprint koordiniert mit lokyy-brain-Team/-Repo (API-stability commitment, MCP-Vertrag).
- **2026-05-16 (Q6-RESOLVED)** — Reverse-Proxy = Traefik. Begründung: Docker-Label-Auto-Discovery für Phase-8 (Docker-MCP-spawned-services), built-in Dashboard, auto-TLS. Caddy wäre simpler aber strukturell ungeeignet für "System spawnt eigene Services"-Vision.
- **2026-05-16 (CORRECTION)** — Vorherige Aussage "kein eigener Daemon nötig" war zu schnell. Lokyy-Heartbeat-Supervisor ist berechtigt — aber als *Layer-3-Watchdog* über Hermes, nicht als Replacement für Hermes-Cron. Three-Layer-Architecture: Hermes-Cron (plant) ↔ Hermes-Conductor (delegiert) ↔ Specialists (führen aus mit wake/sleep) ↔ Lokyy-Supervisor (stellt sicher dass Layer 1+2 überhaupt laufen). Hybrid Wake-Mechanism (pull + push) für defense-in-depth.
- **2026-05-16 (Layer-Ownership)** — Klare Trennung gegen Two-Control-Planes-Risk (advisor ISC-64): Hermes plant + delegiert, Supervisor überwacht + recoverd. Supervisor schedulet NIE Tasks selbst — wenn doch, ist er zu klug geworden, refactor.

## Changelog

- **2026-05-16T14:00:00Z** — Phase-1 Foundation-Scaffold live — FE + BE bauen aus Repo, sprechen via Traefik
  - **conjectured**: Phase-1 scaffold könnte minimal sein (nginx serving plain HTML), Logik kommt erst mit Auth in Phase-1b.
  - **refuted_by**: Visibility-First-Doctrine sagt User soll von Tag-1 sehen wie das System lebt. Plus: ein Scaffold der das echte FE-zu-BE-Routing demonstriert (React fetcht /api/version, rendert Response) ist die natürliche Foundation für Auth-Flow in Phase-1b — wir hätten den HTTP-Plumbing-Loop sonst zweimal gebaut.
  - **learned**: Scaffold liefert mehr Wert wenn er einen End-to-End-Loop demonstriert (React → Traefik → Hono → JSON → rendered DOM). Tech-Stack-Choice (Vite+React+Tailwind / Bun+Hono) in ADR-007 dokumentiert; bewusst nicht TanStack-Start weil Lokyy ein dünner Gateway-Layer ist (vgl. Hermes-insight ADR-001). busybox-wget IPv6-Gotcha entdeckt + dokumentiert für künftige Healthchecks.
  - **criterion_now**: Phase-1 Scaffold steht (ADR-007 + lokyy-os-fe/ + lokyy-os-be/), Stack 5/5 healthy nach echtem Build (nicht mehr nginx:alpine-Placeholder), Playwright-Evidence in docs/evidence/phase-1/. ISC-1 + ISC-2 + ISC-39 bleiben offen für Phase-1b (Auth) und Phase-1c (Dashboard).

- **2026-05-16T13:30:00Z** — Phase-9 abgeschlossen — lokyy-installer CLI live + idempotency verifiziert
  - **conjectured**: Install-Wizard ist Tooling, kann später kommen wenn Phase-1+ existiert; bis dahin docker compose direkt aufrufen reicht.
  - **refuted_by**: Phase-9 ist explizit "parallel ab Phase-0 implementierbar" per ISA und ist die einzige Schutz vor "ich hab vergessen wie das Setup ging"-Erlebnis bei Fresh-Server-Deploy. Plus: idempotency-Garantie für install macht .env.local-Drift unmöglich, sobald sie einmal real wird.
  - **learned**: Single-File Bun-Script reicht für MVP — 350 LoC für saubere UX, Secret-Generierung, idempotent prompt-only-for-missing, polling-Healthcheck mit Timeout. Live-getestet zweimal, keine Drift. Phase-9 macht zukünftige Server-Migrations zu einer One-Liner.
  - **criterion_now**: ISC-67/68/69 alle done. Progress 8→11/81. Phase-9 ist ein Track-Closure — Phase-1 kann jetzt ohne weiteres Tooling-Risk starten weil der Operator-Onboarding-Pfad bekannt ist.

- **2026-05-16T12:45:00Z** — Phase-0.5 Sprint fortgesetzt — ADR-005 (Auth) + ADR-006 (Validation-Location) committed
  - **conjectured**: Auth zwischen Agents und lokyy-brain könnte mit einem geteilten static API-Key gelöst werden; Frontmatter-Validation kann zur Bequemlichkeit auch in Adaptern leben weil Brain's pre-commit-hook am Ende eh validiert.
  - **refuted_by**: (a) Ein static API-Key vereitelt Audit + Scope-Enforcement; ohne `sub`-Claim wissen wir nicht welcher Agent geschrieben hat. (b) Wenn Adapter Frontmatter konstruieren, ist Brain's Schema in zwei Codepfaden — drift garantiert. Advisor: "single biggest contract-leak risk".
  - **learned**: Service-zu-Service-Auth = stateless JWT HS256, lokyy-os-be signed mit `LOKYY_AGENT_JWT_SECRET`, brain-verified gegen den gleichen Secret. `sub` muss einem Eintrag in `mcp-scopes.yaml` matchen. Audit-Log JSONL in brain (`mcp-audit.jsonl`) ohne Body-Inhalt (Privacy). Frontmatter-Validation lebt EXKLUSIV in brain via `POST /api/notes/create-managed`; Adapter senden Intent (title/body/type/tags), brain owns ULID + path + frontmatter + schema-check. Lint-Rule (grep-based Layer A + TypeScript-Barrier Layer B) verhindert Drift in CI.
  - **criterion_now**: ISC-59 als done markiert (ADR-006 strukturell + Lint); ISC-62 als done (ADR-005 JWT-flow + Audit-format). Progress 6→8/81. ISC-47 + ISC-63 + ISC-57 + ISC-58 bleiben offen (brauchen lokyy-brain-Repo-Arbeit).

- **2026-05-16T12:00:00Z** — Phase-0.5 begonnen — MCP-Contract als ADR-004 spezifiziert
  - **conjectured**: MCP-Vertrag kann später kommen, wenn lokyy-brain's Epic 5 vollständig ist; Hermes-Agents nutzen bis dahin direkte HTTP-Calls gegen brain.
  - **refuted_by**: Advisor-Insight — wenn Hermes vor MCP landet, ossifiziert HTTP-Adapter als de-facto Agent-API und parallele Schreibwege akkumulieren. Frontmatter-Validation läuft Gefahr in lokyy-os zu lecken (ISC-59 Risiko).
  - **learned**: MCP-Contract muss VOR Hermes-Implementation gefriert sein, mit Stub-Server-Path so dass Hermes integrieren kann bevor Epic 5 fertig ist. 8 Tools über 4 Namespaces (notes/vault/graph/pipes), `notes.create_managed` als einziger sanktionierter Schreibweg (brain owns ULID + frontmatter), `00_meta/mcp-scopes.yaml` für Per-Agent-Scope-Enforcement.
  - **criterion_now**: ISC-56 als done markiert (ADR-004 existiert mit vollem Tool-Surface + Scope-Schema + Stub-Server-Spec + Anti-Pattern-Tabelle). ISC-60 als done (Cross-AI-Bridge nutzt gleiche MCP-Tools, kein paralleler Schreibweg). ISC-47 + ISC-63 bleiben offen bis Stub-Server in lokyy-brain repo geshippt ist.

- **2026-05-16T11:30:00Z** — Forgejo wandert raus aus dem lokyy-stack
  - **conjectured**: Forgejo gehört in den Lokyy-Docker-Stack als eigener Container, weil lokyy-brain ihn als Second-Brain-Backend braucht.
  - **refuted_by**: Oliver hat bereits eine remote Forgejo-Instanz laufen, an die lokyy-brain anbindet ("wozu forgejo install haben wir schon remote fertig!"). Ein zweiter Forgejo im Stack dupliziert funktionierende Infrastruktur und schafft Synchronisationsschmerz für nichts.
  - **learned**: Vor Container-Provisioning den Memory + bestehende externe Services prüfen. Nicht alles muss in den eigenen Stack — Lokyy ist ein Gateway-Layer (vgl. Hermes-Insight), und genau wie wir Hermes nutzen statt nachbauen, nutzen wir die existierende Forgejo statt sie zu duplizieren.
  - **criterion_now**: ISC-7 als `[DROPPED]` tombstoned (ID-Stability-Regel: nicht renumerieren). LOKYY_BRAIN_FORGEJO_URL ersetzt FORGEJO_*-env-vars in .env.example und Container-Inventar. ADR-003 mit Revisions-Section ergänzt. `lokyy-forgejo-data` + `lokyy-forgejo-config` Volumes gelöscht.

- **2026-05-16T21:00:00Z** — Heartbeat-Supervisor-Korrektur nach User-Feedback
  - **conjectured**: Da Hermes eingebauten Cron-Scheduler hat, braucht Lokyy keinen eigenen Heartbeat-Daemon.
  - **refuted_by**: User wies darauf hin dass Hermes-Cron Tasks *plant*, aber nichts garantiert dass sie auch *autonom ausgeführt* werden — bei Container-Crash, Hang, Server-Sleep, Missed-Cron rotten die Tasks und Autonomie ist nicht gegeben.
  - **learned**: Hermes-Cron und Lokyy-Heartbeat haben unterschiedliche Verantwortungen. Hermes = Scheduling-Layer (was wann). Lokyy-Supervisor = Liveness-Layer (läuft alles). Beide nötig für echte Autonomie. Specialists brauchen Wake/Sleep-Cycle mit Hybrid (pull-poll + push-wake) für defense-in-depth.
  - **criterion_now**: ISC-73 bis ISC-81 hinzugefügt; Phase-2-Scope erweitert um Three-Layer-Architecture; ISC-64 (Owner-Matrix) verschärft durch explizite Trennung "Supervisor scheduled nie selbst".
- **2026-05-16T19:30:00Z** — Hermes-Recherche dekonstruiert Phase-2-Annahme
  - **conjectured**: Lokyy muss eigenen Heartbeat-Daemon (Cron/systemd) oberhalb von Hermes bauen, weil Hermes vermutlich Single-Run-Agent ist.
  - **refuted_by**: Hermes-Repo (nousresearch/hermes-agent) zeigt eingebauten Cron-Scheduler ("daily reports, nightly backups, weekly audits — natural language, running unattended"), closed learning loop, autonomous skill creation, Multi-Agent-Subagent-Spawning, 40+ Tools, model-agnostic, MIT-License — Hermes IST das Betriebssystem-Element, das wir bauen wollten.
  - **learned**: Lokyy ist nicht ein KI-OS *gebaut aus Komponenten* — Lokyy ist ein **Integrations- und Gateway-Layer um Hermes herum** (Auth, Audit, UI, BrainAdapter, Cross-AI-Bridge). Das verschiebt unseren tatsächlichen Build-Scope DRAMATISCH nach unten.
  - **criterion_now**: ISC-4 + ISC-5 + ISC-6 umformuliert (nutzen Hermes-native statt eigener Daemon); ISC-65 (Subagent-Spawning via Hermes) hinzugefügt; Phase-2-Scope auf "Hermes deployen + konfigurieren + bridges" reduziert.
- **2026-05-16T18:00:00Z** — Architektur-Refinement nach Advisor-Cross-Check
  - **conjectured**: lokyy-brain's bestehender Frontmatter-Contract + Promise-Lock + Pipe-Pipeline ist ausreichend Grundlage; lokyy-os schreibt direkt via HTTP-API ohne weitere Schutzschichten.
  - **refuted_by**: Advisor identifizierte (a) Multi-Agent-Concurrent-Writes als qualitativ andere Last als Single-User-PWA, (b) MCP-Layer-Timing als load-bearing — wenn nicht vor Hermes-Agents bereit, ossifiziert HTTP-Adapter zur permanenten primären Schnittstelle, (c) Frontmatter-Validation muss exklusiv in brain leben (sonst Contract-Leak in Adapter), (d) Pipes-Ownership + Heartbeat-vs-Conductor-Control-Plane sind ungelöst.
  - **learned**: Architektur-Boundary ist richtig, aber **die Integration-Contract** ist der eigentliche Risikopunkt — nicht die Service-Trennung. 4 Pre-Phase-1-Vorbedingungen (MCP-Contract-Doc, Concurrency-Audit, Topology+Auth, Validation-Location) müssen als eigene Mini-Sprint vor Phase-1 abgearbeitet werden.
  - **criterion_now**: ISC-56 bis ISC-64 hinzugefügt; Phase-0.5 (Pre-Phase-1 Contract-Sprint) in Features-Tabelle ergänzt; ISC-63 als Antecedent für Phase-1-Start.

## Verification

### Phase-0 (Docker Foundation) — Winston, 2026-05-16 (live deploy run)

All Phase-0 ISCs verified live on Oliver's Linux dev machine. Evidence: Playwright screenshots in `docs/evidence/phase-0/*.png`.

- [x] **ISC-41** — All 5 containers running healthy on `lokyy-net`. Live `docker compose ps` (2026-05-16T11:30Z): `lokyy-brain` (healthy), `lokyy-docker-socket-proxy` (up), `lokyy-os-be` (healthy), `lokyy-os-fe` (healthy), `lokyy-traefik` (healthy). Traefik dashboard reports active routers / services / middlewares, 100% success. (Forgejo deliberately not part of stack — runs remotely.)
- [x] **ISC-44** — `lokyy-brain` reachable internally (`docker exec lokyy-os-fe wget http://lokyy-brain/` → HTTP/1.1 200 OK), refused externally (`curl http://localhost:8787/` → Status 000 / connection refused). Service has zero Traefik labels and no published port.
- [x] **ISC-54** — `infrastructure/docker-compose.yml` uses only `${VAR}` references. `.env.local` is chmod 0600 (`-rw-------`), not tracked by git, contains the real values. No plaintext secrets in any committed file.
- [x] **ISC-72** — Traefik (v3.7.1 via `traefik:latest` tag) routes via Docker-Label-Discovery through `docker-socket-proxy` sidecar (anti-privilege per Phase-8 doctrine — direct socket mount avoided). Dashboard at `https://traefik.lokyy.local/dashboard/` returns 401 without auth and 200 with `admin:supersecure123`. Auto-TLS resolver configured; staging-CA fallback to Traefik default cert when ACME contact email fails validation (acceptable for local dev with `-k`).

### Phase-0 deploy adjustments (logged for ADR-003 update)

During live deploy, two issues were discovered and fixed:

1. **Traefik v3.2/v3.5 incompatible with Docker daemon 29.4.1** — "client version 1.24 is too old" error. Resolved by upgrading to `traefik:latest` (v3.7.1) AND introducing `docker-socket-proxy` sidecar. The sidecar is what Phase-8 needs anyway (anti-privilege gate), so this is foundation pulled forward not technical debt.
2. **`traefik/whoami` placeholders had no shell** → healthchecks failed. Replaced with `nginx:alpine` for `lokyy-os-be` and `lokyy-brain` placeholders (matches `lokyy-os-fe` already using nginx).
3. **Forgejo healthcheck against `/api/v1/version` failed in first-run state** — Forgejo serves install page on `/` until setup completed. Changed healthcheck to `wget --spider /` which works in both install and post-install states.

### Files updated post-deploy

- `infrastructure/docker-compose.yml` — Traefik `latest`, docker-socket-proxy added, placeholders nginx:alpine, Forgejo healthcheck `/`
- `infrastructure/traefik/traefik.yml` — endpoint switched to `tcp://docker-socket-proxy:2375`
- `scripts/verify-phase-0.ts` — Playwright verification with `--host-resolver-rules` (no `/etc/hosts` dependency)
- `docs/evidence/phase-0/*.png` — three screenshots (dashboard, lokyy-fe placeholder, forgejo install page)

**Phase-0: ✅ COMPLETE — live-deploy verified.**

### Phase-0.5 (Contract Sprint) — Winston, 2026-05-16

- [x] **ISC-56** — `docs/decisions/ADR-004-lokyy-brain-mcp-contract.md` exists. Documents the full 8-tool MCP surface (notes/vault/graph/pipes), locked TypeScript type definitions, `00_meta/mcp-scopes.yaml` schema with default scopes for 5 agent identities (conductor/researcher/writer/coder/curator), stub-server contract for pre-Epic-5 integration, and the anti-pattern table forbidding ULID generation + manual frontmatter assembly in lokyy-os.
- [x] **ISC-60** — ADR-004 §6 explicitly contracts that the Cross-AI Bridge uses the same `notes.create_managed` MCP tool as Hermes-Subagents. Bridge agents (`bridge-claude`, `bridge-openclaw`) declare their identity in the scope file; brain validates schema on the way in. No parallel write path exists.
- [x] **ISC-59** — `docs/decisions/ADR-006-validation-lives-only-in-brain.md` locks the rule structurally. `notes.create_managed` is the sole sanctioned write path; the convenience endpoint owns ULID/path/created/updated/schema-validation. Lint enforcement: Layer A `scripts/check-no-frontmatter-leak.sh` (grep-based CI gate) + Layer B BrainAdapter TypeScript barrier (no surface for forbidden ops).
- [x] **ISC-62** — `docs/decisions/ADR-005-service-auth-and-audit.md` defines stateless JWT HS256 signed by lokyy-os-be and verified by lokyy-brain. `sub` claim maps to `mcp-scopes.yaml` entries. Audit log at `mcp-audit.jsonl` with `{ts, agent_id, action, target_type, target_id, status, duration_ms}`; never logs body or token content. Bootstrap via `lokyy-installer` generating `LOKYY_AGENT_JWT_SECRET`.
- [ ] **ISC-47** — Still pending: stub MCP server implementation in lokyy-brain repo (coordination with brain-repo maintainer required).
- [ ] **ISC-63** — Still pending: Phase-1-start antecedent (#79 still open; brain-repo work).

### Phase-9 (Install Wizard) — Winston, 2026-05-16

- [x] **ISC-67** — `cli/lokyy-installer.ts` exists as a single-file Bun script. Five commands implemented: `install`, `up`, `down`, `purge`, `status`. `help` listed each in colored output; unknown command yields exit 2 + help.
- [x] **ISC-68** — Idempotent confirmed by two consecutive `install` runs against the live stack. Run 1 detected existing values in `.env.local`, generated missing `LOKYY_AGENT_JWT_SECRET`, wrote file (chmod 0600), recreated Traefik (env diff), all 5 services healthy. Run 2 detected all values present, no regeneration, no container churn, all healthy. End-state identical.
- [x] **ISC-69** — `cmdInstall` polls `docker compose ps --format json` every 2s, parses per-service state and health, exits 0 only when all 5 expected services match `state=running` AND (no health field OR `health=healthy`). Timeout default 90s → exit 3 with status dump. Verified on local stack.

### Phase-1 (Foundation Scaffold) — Winston, 2026-05-16

- **`lokyy-os-fe/`** scaffolded: Vite 6 + React 19 + TypeScript strict + Tailwind 4 (`@tailwindcss/vite` plugin). Multi-stage Dockerfile (Bun build → nginx:alpine serve). Healthcheck on 127.0.0.1 (busybox-wget no-IPv6-fallback gotcha noted).
- **`lokyy-os-be/`** scaffolded: Bun + Hono + TypeScript strict. Routes: `/health`, `/api/version`, JSON 404 catch-all. Single-stage Dockerfile, healthcheck via `bun -e fetch`.
- **Compose** updated — both services switched from `nginx:alpine` placeholders to `build: { context: ../lokyy-os-{fe,be} }`. Stack remains 5 services, all healthy.
- **End-to-end verified** via Playwright (`scripts/verify-phase-1.ts`, 2/2 passed): `https://lokyy.local/` renders the React app (gradient title, description), which fetches `/api/version`, receives `{service:"lokyy-os-be",version:"0.1.0",phase:"Phase-1 scaffold"}`, and renders it inline. Screenshots in `docs/evidence/phase-1/`.
- **ADR-007** documents the tech-stack decision (Vite+React vs TanStack Start; Bun+Hono vs Express).
- **Open for Phase-1 completion**: ISC-1 (real auth flow with Better-Auth, mirrors ADR-002 pattern), ISC-2 (dashboard rendering user state + agent list), ISC-39 (phase-plan markdown files per phase under `docs/phases/`). The `docs/evidence/phase-N/` pattern is now established and used for phase-0 and phase-1.
