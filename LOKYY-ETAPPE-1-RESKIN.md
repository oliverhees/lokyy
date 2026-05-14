# Lokyy — Etappe 1: Reskinning des Hermes Workspace zum Lokyy-Look

> The full spec for Etappe 1 is maintained in this file.
> See CLAUDE.md for a condensed summary of rules and constraints.

This file contains the complete brief for Etappe 1 as handed over by Oliver.
All BMAD agents working on Etappe 1 issues must read this file before starting work.

---

## Quick Reference

- **GitHub Issues:** All tasks tracked at https://github.com/oliverhees/lokyy/issues
- **Upstream:** https://github.com/outsourc-e/hermes-workspace (tag v2.3.0)
- **Branch strategy:** All Lokyy changes on `lokyy/main`, prefix `lokyy:`
- **Control checkpoints:** After Issue #11 (Step 2 recon), after Issue #13 (Step 3.1 design)

---

## ⚠️ PFLICHT-ABSCHNITT 1 — Arbeitsmodus: BMAD-Orchestrierung

Claude Code is exclusively Orchestrator. Every task is delegated to BMAD agent roles.
No direct implementation by the Orchestrator. See CLAUDE.md.

## ⚠️ PFLICHT-ABSCHNITT 2 — Diary-Pflicht

One file per session under `docs/diary/YYYY-MM-DD-session-NN.md`.
Updated during the session, not reconstructed at the end. See CLAUDE.md.

## ⚠️ PFLICHT-ABSCHNITT 3 — Was du in dieser Etappe NICHT tust

1. Keine Funktionsänderungen — nur Aussehen, nicht Verhalten
2. `src/routes/api/*`, `src/routeTree.gen.ts`, `src/router.tsx`, `src/stores/*`, `server-entry.js`, `src/lib/*` — NICHT anfassen
3. Keine zweite UI-Bibliothek installieren
4. Das Shadcn-Kit nicht code-technisch transplantieren
5. Kein Login, keine Auth-Änderung
6. Keine Vault-Seiten, keine MCP-Anbindung, keine Multi-Tenancy
7. Memory/Knowledge-Unterbau nicht anfassen
8. Interne Code-Bezeichner nicht umbenennen
9. Die fremde LICENSE nicht verändern oder löschen
10. Kein Deployment
11. `package.json` nur minimal anfassen — erlaubt: `tw-animate-css`, ggf. `lucide-react`
12. Keine Kernarchitektur-Änderungen

---

> Full brief (Steps 1–6, all phases, all constraints) from original Oliver brief preserved below.
> [The complete original brief text is stored in the git history via the initial commit]
