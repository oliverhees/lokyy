# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Lokyy Is

Lokyy is a self-hosted KI-Betriebssystem for enterprises. The web frontend lives in `lokyy-workspace/` — a private distribution fork of [Hermes Workspace](https://github.com/outsourc-e/hermes-workspace) (pinned to `v2.3.0`, branch `lokyy/main`). The fork is purely visual: all functional logic (SSE streaming, Conductor multi-agent orchestration, Jobs/Cron, Skills, Memory, MCP) comes from upstream unchanged.

Current stage: **Etappe 1** — reskinning the Hermes UI to the Lokyy look (Shadcn-Dashboard style, dark default, own branding). See `LOKYY-ETAPPE-1-RESKIN.md` for the full spec.

---

## Orchestrator Mode — Non-Negotiable

**Claude Code is exclusively orchestrator.** No direct code implementation. Every task is delegated to BMAD agent roles and agent tasks.

- Decompose work into BMAD stories/tasks → dispatch to the right agent role → review results → coordinate
- If you catch yourself writing code directly instead of delegating: **STOP**
- BMAD is already installed (v6.6.0). Never re-initialize it.

---

## Diary — Mandatory Every Session

One file per session under `docs/diary/YYYY-MM-DD-session-NN.md`. Updated **during** the session, not reconstructed at the end. A session without a complete diary entry is not closed.

Minimum per entry: goal, starting state, delegations (which agent, which task, what brief), results, decisions + rationale, problems, files touched, end state, next step.

---

## BMAD Setup

| Config | Value |
|--------|-------|
| Version | 6.6.0 |
| Communication language | German |
| Document output language | English |
| Planning artifacts | `_bmad-output/planning-artifacts/` |
| Implementation artifacts | `_bmad-output/implementation-artifacts/` |
| Project knowledge | `docs/` |

**Agent roster** (invoke via `Skill` tool):

| Skill | Agent | Role |
|-------|-------|------|
| `bmad-agent-analyst` | Mary | Business Analyst — requirements, research, recon |
| `bmad-agent-architect` | Winston | System Architect — design decisions, ADRs |
| `bmad-agent-dev` | Amelia | Senior Engineer — implementation |
| `bmad-agent-pm` | John | Product Manager — stories, priorities |
| `bmad-agent-ux-designer` | Sally | UX Designer — design concepts |
| `bmad-agent-tech-writer` | Paige | Tech Writer — docs, README, diary |

**Useful utility skills:** `bmad-help`, `bmad-brainstorming`, `bmad-document-project`, `bmad-create-story`, `bmad-dev-story`, `bmad-sprint-planning`, `bmad-code-review`, `bmad-party-mode`

---

## Repo Structure

```
lokyy/                          ← this repo root
├── CLAUDE.md                   ← this file
├── LOKYY-ETAPPE-1-RESKIN.md    ← full spec for current stage
├── LOKYY.md                    ← list of touched upstream files (created during Etappe 1)
├── LICENSE                     ← Hermes MIT license — NEVER touch
├── NOTICE                      ← Lokyy attribution notice
├── docs/
│   ├── diary/                  ← session logs (mandatory)
│   ├── decisions/              ← ADRs
│   ├── recon-findings.md       ← reverse-engineering output (Step 2)
│   ├── lokyy-design.md         ← approved design concept (Step 3.1)
│   ├── licensing-todo.md       ← license inventory (Step 2.7)
│   ├── questions.md            ← open questions for Oliver
│   └── etappe-1-summary.md     ← final summary (Step 6)
├── _bmad/                      ← BMAD framework (installer-managed, do not modify core/)
├── _bmad-output/               ← BMAD agent outputs
└── lokyy-workspace/            ← Hermes Workspace fork (Step 1.2, not yet cloned)
```

---

## lokyy-workspace Tech Stack (once cloned)

React 19 · TypeScript strict · Vite · Tailwind 4 · `@base-ui/react` (not Radix) · TanStack Router/Start · Zustand · pnpm

```bash
# Inside lokyy-workspace/
pnpm install          # install deps
pnpm dev              # dev server
pnpm build            # production build
pnpm add tw-animate-css   # only new dep allowed in Etappe 1
```

---

## Git Workflow

```bash
# Lokyy changes always go on lokyy/main
# Commit prefix: lokyy:
# e.g.: git commit -m "lokyy: add Shadcn token layer"

# Upstream sync
git fetch upstream
git merge upstream/main --no-ff
```

Remote `upstream` = `https://github.com/outsourc-e/hermes-workspace`. Remote `origin` = Lokyy's own repo (set during Step 1.2).

---

## Etappe 1 Control Checkpoints

Two mandatory stops before Oliver can unblock:

1. **After Step 2:** Present `docs/recon-findings.md` + `docs/licensing-todo.md` — wait for approval before starting Step 3
2. **At Step 3.1:** Present `docs/lokyy-design.md` (color tokens, logo, radius) — wait for approval before implementation

---

## Hard Constraints for Etappe 1

Do not touch:
- `src/routes/api/*`, `src/routeTree.gen.ts`, `src/router.tsx`
- `src/stores/*`, `server-entry.js`, `src/lib/*`, all hooks
- Internal code identifiers (`"name": "hermes-workspace"`, theme IDs `claude-nous` etc., component names)
- `LICENSE` file

Do not:
- Install a second UI library (Base UI is already there, Shadcn-Base-UI integration covers everything)
- Change any functional behavior — reskin means visuals only
- Deploy, push to production, or touch auth/login

If any of the above seems necessary to finish Etappe 1: note it in `docs/questions.md` and ask Oliver first.

---

## Branding Rule

> Lokyy everywhere a human sees it. Original names stay everywhere only code sees them.

Visible UI text, tab title, logo, favicon, README, docs → Lokyy.  
Package name, theme IDs, variable names, component names in code → unchanged.
