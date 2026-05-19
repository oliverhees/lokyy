# System-Audit 2026-05-19

Playwright-tour through every sidebar route. Findings below.

## Summary table

| Route | Loaded? | Stub? | Empty? | API-fails | Console-errs | CTAs |
|---|---|---|---|---|---|---|
| Dashboard (/dashboard) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Chat (/chat) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Agents (/agents) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Tasks (/tasks) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Sessions (/sessions) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Schedule Jobs (/jobs) | ✓ | no | yes | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Dashboards (/dashboards) | ✓ | no | yes | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Prompt Library (/prompts) | ✓ | no | yes | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Second Brain (/vault) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Workflows (/workflows) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Teams (/teams) | ✓ | no | yes | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Integrations (/integrations) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Channels (/channels) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Insights (/insights) | ✓ | **YES** | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Memory (/memory) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Tools (/tools) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Plugins (/plugins) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Webhooks (/webhooks) | ✓ | **YES** | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Logs (/logs) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| n8n (/n8n) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |
| Settings (/settings) | ✓ | no | no | 0 | 0 | Lokyy / OOliveroliver@lokyy.local / Toggle theme |

## Per-route detail

### Dashboard (`/dashboard`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Dashboard 22 Apr 2026 - 19 May 2026 Download Team Members Invite your team members to collaborate. Toby Belhome contact@bundui.io Viewer Jackson Lee pre@example.com Developer OM Hally Gray hally@site.com Viewer Subscriptions +4850 +180.1%…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Dashboard.png`

### Chat (`/chat`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Neuer Chat Heute Schreib mir eine HTML-Landing-Page Letzte 7 Tage Schreib mir eine HTML-Landing-Page Sag in einem einzigen Wort: hi smoke Neuer Chat 0 / 200.0k 0% Wie kann Lokyy dir heute helfen? Tipp / für Commands oder wähle einen Vorsc…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Chat.png`

### Agents (`/agents`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Agents Deine eigenen Lokyy-Agents (custom prompts + curated skills) und die Hermes-System-Profile read-only. Neuer Agent Meine Agents user-created · editable TEST Agent test-agent lkjsadfojwej 3 Skills default System Agents (Hermes Profil…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Agents.png`

### Tasks (`/tasks`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Tasks Hermes-Kanban nicht initialisiert Init via hermes kanban init.…

**Indicators:** init 

**Screenshot:** `docs/evidence/audit-2026-05-19/Tasks.png`

### Sessions (`/sessions`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Sessions Alle Hermes-Sessions sortiert nach letztem Update. 20 insgesamt. 20 Sessions api-d407ce66cf76b464 claude-sonnet-4-6 msg — api-5071c7ca71393af7 claude-sonnet-4-6 msg — api-cf9a5cbfaaefd1ba claude-sonnet-4-6 msg — api-5fef910489b0c…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Sessions.png`

### Schedule Jobs (`/jobs`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Schedule Jobs Wiederkehrende Hermes-Aufgaben. Schedule via Cron-Expression oder30m/2h Style. Neuer Job Noch keine Schedule-Jobs Klick „Neuer Job" oder leg via CLI an: hermes cron create…

**Indicators:** empty 

**Screenshot:** `docs/evidence/audit-2026-05-19/Schedule_Jobs.png`

### Dashboards (`/dashboards`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Dashboards Selbstgebaute Dashboards — agentengetrieben, mit Historie. Chatte deinen Wunsch und Lokyy bastelt die View + den Producer-Skill. Neues Dashboard KI-News ki-news «Tägliche AI/Tech-Schlagzeilen als große Cards mit violettem Akzen…

**Indicators:** empty 

**Screenshot:** `docs/evidence/audit-2026-05-19/Dashboards.png`

### Prompt Library (`/prompts`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Prompt Library Speichere wiederverwendbare Prompts mit Tags und kopiere sie in einem Klick. Neuer Prompt Noch keine Prompts Klick „Neuer Prompt", um deinen ersten Template anzulegen.…

**Indicators:** empty 

**Screenshot:** `docs/evidence/audit-2026-05-19/Prompt_Library.png`

### Second Brain (`/vault`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Second Brain Read-only Obsidian-Vault-Anbindung. Lokyy zeigt dir Markdown-Notes ohne Schreibzugriff. Kein Obsidian-Vault konfiguriert Setze die Env-Variable LOKYY_VAULT_PATH=/pfad/zu/deinem/vault und starte den Dev-Server neu. Settings-UI…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Second_Brain.png`

### Workflows (`/workflows`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Workflows Verkette Skills, Tools, Agents und Dashboards zu wiederverwendbaren AI-Workflows. Trigger: Cron, Manual, Dashboard-Klick, Webhook. Neuer Workflow Editor E2E manual 4 Nodes lief schon editor-1779115934047 Agent Demo manual 2 Node…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Workflows.png`

### Teams (`/teams`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Teams Stelle Agent-Teams zusammen für Multi-Agent-Aufgaben. Orchestrierung kommt in eigener Phase. Neues Team Noch keine Teams Klick "Neues Team", um deinen ersten Multi-Agent-Mix anzulegen.…

**Indicators:** empty 

**Screenshot:** `docs/evidence/audit-2026-05-19/Teams.png`

### Integrations (`/integrations`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Integrations Verbinde Lokyy mit deinen Tools. Diese sind kuratierte Provider — separat vom MCP-Hub. 0/0 verbunden.…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Integrations.png`

### Channels (`/channels`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Channels Hermes als Bot in Messaging-Plattformen. 0/0 konfiguriert. Setup via hermes gateway setup.…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Channels.png`

### Insights (`/insights`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Insights Token-Verbrauch und Tool-Patterns der letzten 30 Tage. Sessions 0 Messages 0 Tool Calls 0 Total Tokens 0 Active Time: 0m [lokyy] Hermes Agent is not deployed yet. This panel goes live in Phase-2 of the Lokyy roadmap.…

**Indicators:** **stub** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Insights.png`

### Memory (`/memory`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Memory Hermes-Memory: Built-in (MEMORY.md/USER.md) ist immer aktiv. Externe Provider können dazugeschaltet werden. Aktiver Memory-Stack Built-in (MEMORY.md / USER.md) always active Externer Provider: none Verfügbare Provider Setup-Wizard:…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Memory.png`

### Tools (`/tools`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Tools Built-in Toolsets von Hermes (0 aktiv, 0 aus). Toggle via hermes tools enable/disable. lade Tools……

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Tools.png`

### Plugins (`/plugins`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Plugins Git-basierte Hermes-Plugins. Install via hermes plugins install <repo> 82 Plugins claude-code enabled — Delegate coding to Claude Code CLI (features, PRs). autonomous-ai-agents codex enabled — Delegate coding to OpenAI Codex CLI (…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Plugins.png`

### Webhooks (`/webhooks`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Webhooks Event-driven Agent-Aktivierung via HTTP-Webhooks. Webhook-Platform nicht aktiviert Setup: hermes gateway setup oder manuell in ~/.hermes/config.yaml platforms.webhook.enabled: true [lokyy] Hermes Agent is not deployed yet. This p…

**Indicators:** **stub** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Webhooks.png`

### Logs (`/logs`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Logs agent.log + gateway.log + errors.log Refresh Lines Level (optional) 2026-05-19 07:38:59,764 INFO aiohttp.access: 127.0.0.1 [19/May/2026:07:38:59 +0000] "GET /v1/models HTTP/1.1" 200 397 "-" "curl/8.14.1" 2026-05-19 07:39:12,954 INFO …

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/Logs.png`

### n8n (`/n8n`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme n8n Workflow-Automatisierung embedded in Lokyy. Konfiguriere die URL in den Settings. n8n-URL nicht konfiguriert Gehe in die Settings und trage die URL deiner n8n-Instanz ein. Settings öffnen…

**Indicators:** 

**Screenshot:** `docs/evidence/audit-2026-05-19/n8n.png`

### Settings (`/settings`)

**Loaded:** yes

**Body preview:** k Command Palette Search for a command to run... Toggle theme Settings lade……

**Indicators:** init 

**Screenshot:** `docs/evidence/audit-2026-05-19/Settings.png`
