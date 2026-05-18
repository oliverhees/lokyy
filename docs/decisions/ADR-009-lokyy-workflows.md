# ADR-009 — Lokyy Workflows (Visual Composition Layer)

- **Status:** accepted
- **Date:** 2026-05-18
- **Phase:** Phase-5
- **Brainstorm-Doc:** `docs/decisions/PHASE-5-WORKFLOWS-BRAINSTORM.md`

## Context

Lokyy hat ein Inventory von Bausteinen — Hermes-Skills, Hermes-Tools, Lokyy-System-Skills, Dashboards, Cron, Capability-Tokens, Audit. Was fehlt ist **Komposition**: ein Mechanismus mit dem ein User diese Bausteine **visuell** zu wiederverwendbaren Workflows verkabelt.

Das ist Lokyys eigentlicher USP. n8n / Zapier / Make decken klassische SaaS-API-Integration ab. LangFlow / Flowise / Dify decken LLM-Chains ab. **Niemand baut die Schnittmenge "AI-native + Self-Hosted + Dashboard-bound + Personal-OS"** — genau dort positioniert sich Lokyy.

## Decision

Wir bauen **Lokyy Workflows** als nächste Major-Phase. Sieben Architektur-Entscheidungen wurden im Brainstorming getroffen:

### 1. Schema-Modell: **DAG** (gerichtet, branching)
Nodes + Edges. Branching ist real für AI-Workflows ("wenn LLM sagt X → Branch A, sonst → Branch B"). xyflow rendert DAGs nativ. Sequenz wäre zu eng, State-Machine zu komplex.

### 2. Runtime-Lokation: **In `lokyy-mcp`**
Workflows komponieren System-Skills — also gehören sie in den System-Bus (ADR-008). Re-use von Tool-Registry, Capability-Tokens, Audit-Log. Keine Duplikation des Trust-Modells in einem zweiten Service.

### 3. Visual Editor: **xyflow (React Flow)**
De-facto Standard für Node-Editor in React. MIT, gut maintained, von n8n + Langflow erprobt. Custom-build würde 4-6 Wochen Edge-Cases produzieren.

### 4. Trigger-Sources (Phase-5.0 Initial Set)
Vier Trigger-Typen werden in der ersten Runde unterstützt:
- **Cron** — zeitbasiert, baut auf Phase-4.5 in-process scheduler auf
- **Manual** — "Jetzt laufen" Button am Workflow
- **Dashboard-Click** — Action-Slot in Dashboard-Template triggert Workflow (siehe §5)
- **Webhook** — externer HTTP-Endpoint, callable mit Bearer-Token

Deferred zu Phase-5.x: Chat-Intent, Event-Bus, File-Watch.

### 5. Workflow ↔ Dashboard: **Volle Bidirektionalität mit Action-Slots**

| Richtung | Mechanismus |
|---|---|
| Workflow → Dashboard | Node-Type `dashboard.save_data` (re-use bestehendes Tool) |
| Dashboard → Workflow | View-HTML kann **Action-Slots** definieren — Buttons/Cards die per `postMessage` ans Lokyy-Parent ein "trigger workflow X with context Y" Event senden |

UI-Implikation: Dashboard-Templates müssen Action-Slots als Konzept lernen. Die Wizard-LLM-Prompts müssen wissen wie man sie generiert.

### 6. Workflow Storage Pattern
Mirror der Dashboards-Struktur:
```
/app/data/workflows/{id}/
  spec.json              ← DAG-definition (nodes + edges + triggers)
  runs/{run-id}.json     ← Run-history mit input/output per node
```
Auf `lokyy-os-db` volume. Phase-3-Swap-target: lokyy-brain.

### 7. Error / Retry / Audit
- **Audit**: jeder Node-Call landet im audit-log (capability-token-pattern aus ADR-008)
- **Retry**: configurable per Node, default 0 (fail-fast)
- **Failure-Policy** per Node: `halt | skip | continue`
- **Run-Record**: input/output jeder Node pro Run gespeichert
- **Error-Surface**: in UI ein "letzter Fehler"-Badge pro Workflow, klickbar zu Detail-View

## Sub-Slice Plan

```
Phase-5.0  Schema + Runtime + Backend-API in lokyy-mcp
Phase-5.1  Workflow-CRUD via lokyy-os-be + /workflows route in lokyy-app
Phase-5.2  Visual Editor (xyflow + custom node types)
Phase-5.3  Triggers: Cron + Manual
Phase-5.4  Triggers: Webhook + Dashboard-Click
Phase-5.5  Action-Slots in Dashboard-Templates (Wizard-Update)
Phase-5.6  Starter-Workflow-Templates (KI-News-Pipeline als erstes)
```

## Topology (target state)

```
┌────────── Lokyy Workflows ─────────────────────────────────────────┐
│                                                                     │
│  /app/data/workflows/{id}/spec.json                                 │
│     ↓ loaded by                                                     │
│  lokyy-mcp                                                          │
│    └─ Workflow-Runtime (new System Skill)                           │
│         ├─ trigger-dispatch (cron, manual, webhook, dashboard)      │
│         ├─ DAG-executor (topo-sort, per-node retry/policy)          │
│         ├─ node-types:                                              │
│         │    ├─ hermes-skill (87 verfügbar)                         │
│         │    ├─ hermes-tool (40+ verfügbar)                         │
│         │    ├─ system-skill (DashboardBuilder, Producer, ...)      │
│         │    ├─ dashboard.save_data (write to dashboard)            │
│         │    ├─ llm-call (Hermes /v1/chat/completions)              │
│         │    ├─ http-fetch (für Webhooks)                           │
│         │    └─ branch (if-then, switch)                            │
│         └─ run-record writer → /app/data/workflows/{id}/runs/       │
│                                                                     │
│  Lokyy-App                                                          │
│    └─ /workflows route                                              │
│        ├─ list + CRUD                                               │
│        ├─ xyflow-based Editor                                       │
│        ├─ Run-history viewer                                        │
│        └─ Action-Slot-Registrar (Dashboard-Card → workflow.trigger) │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Consequences

### Positive
- **Lokyys USP cementiert**: die Bausteine die wir haben werden komponierbar
- **Phase-3 (Brain) profitiert automatisch**: Brain wird nur ein weiterer Node-Type
- **Hermes-Skills sind sofort als Nodes nutzbar** — keine extra Integration
- **Capability-Tokens-System skaliert sauber** — pro-Workflow scoped permissions möglich

### Negative
- Großes Feature, 2-3 Wochen Build wenn fokussiert
- xyflow Bundle-Size +200kb auf lokyy-app
- Action-Slots in Dashboards bedeuten breaking-change am Template-Schema (alte Dashboards funktionieren weiter, aber neue Templates müssen die Convention kennen)

### Migration
- Existing Dashboards bleiben — Action-Slots sind optional (Templates ohne Slots = wie heute)
- Existing Cron-Mechanik in lokyy-mcp wird weiter genutzt, nur Workflow-Trigger als zusätzlicher Caller davon

## Related ADRs

- **ADR-008** — Lokyy System Bus (Tool-Registry, Capability-Tokens) ist die Foundation
- **ADR-007** — Container-first pattern (Workflow-Runtime in lokyy-mcp folgt dem)
- **ADR-006** — Validation lives only in brain (analog: Workflow-Logic lives only in lokyy-mcp)
