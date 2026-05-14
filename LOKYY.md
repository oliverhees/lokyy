# LOKYY.md — Touched Upstream Files

This file tracks every upstream Hermes Workspace file that Lokyy modifies.
It is the merge-conflict early-warning system: a long list = too deep a cut.

**Rule:** If this list exceeds ~8–10 files, pause, rethink architecture, ask Oliver.

---

## Status

**Etappe 1 (Reskinning):** Phase A + B + C + **D done** (Steps 3.2–3.5, Issues [#14](https://github.com/oliverhees/lokyy/issues/14) + [#15](https://github.com/oliverhees/lokyy/issues/15) + [#16](https://github.com/oliverhees/lokyy/issues/16) + [#17](https://github.com/oliverhees/lokyy/issues/17)). Inner workspace pinned to `v2.3.0`, branch `lokyy/main` active. Token-Layer + `@theme inline` + 13 restyled + 8 new components + LokyyShell hinter env-flags + **16 page-files page-frame-reskinned** über 12 Domains (dashboard, operations, swarm, conductor, tasks, jobs, kanban, skills, mcp, memory, files, profiles, chat, terminal, settings). Hermes-Marketing-Routen (`/world`, `/hermes-world`, `/reserve`, `/vt-capital`, `/agora`, `/playground`, `/early-access`) bewusst NICHT reskinned — brief-konformes "hide" via Sidebar-Omission. Hermes-Code-Substanz unangetastet — beide Flags default OFF.

## Integration Model

Inner workspace (`lokyy-workspace/`) is a **nested independent git repo**, not a submodule. The outer repo's `.gitignore` excludes it. See [ADR-001](docs/decisions/ADR-001-lokyy-workspace-integration.md) for the full rationale.

Upstream merge workflow:

```bash
cd lokyy-workspace
git fetch upstream
git merge upstream/main --no-ff
```

The inner repo has only a single remote (`upstream` → `outsourc-e/hermes-workspace`). No `origin` is set yet — see Open Question O1 in ADR-001.

## Pinned Upstream Version

| Field | Value |
|-------|-------|
| Upstream repo | `outsourc-e/hermes-workspace` |
| Pinned tag | `v2.3.0` |
| Commit SHA | `15fa9cd7 chore(release): v2.3.0` |
| Branch | `lokyy/main` (branched off the tag) |

---

## Touched Upstream Files

| File | Reason | Etappe / Issue |
|------|--------|----------------|
| `src/styles.css` | Phase A — bridge block in each of 8 `[data-theme='claude-*']`. Phase B — `@theme inline` block added at top so Tailwind v4 exposes the Lokyy bridge vars as utility classes (`bg-primary`, `border-border`, `ring-ring`, `bg-card`, `bg-sidebar`, `text-foreground`, etc.). Hermes `--theme-*` untouched. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) + [#15](https://github.com/oliverhees/lokyy/issues/15) |
| `src/routes/__root.tsx` | Phase A — bootstrap `themeScript` now forces `.dark` class on `<html>` when no theme is stored (Lokyy dark-default). Whitelist + theme-switch logic unchanged. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |
| `package.json` | Phase A — new dep `tw-animate-css ^1.4.0` (the only Etappe-1-allowed new dep, prereq for Shadcn-style animations in later phases). | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |
| `pnpm-lock.yaml` | Phase A — lockfile sync for `tw-animate-css`. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |
| `src/components/ui/button.tsx` · `input.tsx` · `dialog.tsx` · `alert-dialog.tsx` · `tabs.tsx` · `switch.tsx` · `tooltip.tsx` · `menu.tsx` · `scroll-area.tsx` · `collapsible.tsx` · `preview-card.tsx` · `autocomplete.tsx` · `command.tsx` | Phase B — restyled to consume Lokyy bridge tokens via Tailwind utility classes (`bg-primary`, `bg-card`, `border-border`, `text-foreground`, etc.). Base UI imports preserved, structure unchanged, behavior unchanged. `cva()` pattern in `button.tsx` kept; only variant class-strings swapped. Inline `style={{}}` for Base UI Positioner sizing left in place (functional, not stylistic). | Etappe 1 / [#15](https://github.com/oliverhees/lokyy/issues/15) |
| `src/components/ui/card.tsx` · `badge.tsx` · `separator.tsx` · `skeleton.tsx` · `label.tsx` · `sheet.tsx` · `table.tsx` · `alert.tsx` | Phase B — **new files**, 8 Shadcn-canonical components added to fill the gap identified in Recon §2.3. Built on `@base-ui/react` where a primitive exists (`separator`, `sheet`→`dialog`), pure HTML elsewhere (`card`, `badge`, `skeleton`, `label`, `table`, `alert`). Zero `@radix-ui` imports. Use the project's existing `cn()` helper from `src/lib/utils.ts`. | Etappe 1 / [#15](https://github.com/oliverhees/lokyy/issues/15) |
| `src/components/layout/lokyy-shell.tsx` · `app-sidebar.tsx` · `app-header.tsx` | Phase C — **new files**. Parallel LokyyShell composition (Sidebar + Header + Outlet on CSS-Grid). AppSidebar carries the Lokyy logo lockup, `lokyy` wordmark + `AI OPERATING SYSTEM` CAPS tagline, two sections (`DASHBOARD` + `KNOWLEDGE`) with all 13 main + 4 knowledge nav items from Recon §2.4 (Memory + Knowledge preserved). Active state is a filled indigo pill (`bg-sidebar-primary`), no left border. AppHeader shows pathname-derived breadcrumbs. Uses Phase-B's button/card/separator from `src/components/ui/`. | Etappe 1 / [#16](https://github.com/oliverhees/lokyy/issues/16) |
| `src/components/workspace-shell.tsx` | Phase C — `+5 lines`. Reads `import.meta.env.VITE_LOKYY_LAYOUT === '1'` at top of `WorkspaceShell()`; when set, returns `<LokyyShell>{children}</LokyyShell>` instead of the Hermes shell. Default OFF — Hermes behavior identical to v2.3.0. | Etappe 1 / [#16](https://github.com/oliverhees/lokyy/issues/16) |
| `src/routes/__root.tsx` | Phase C — `+3 lines` inside the splash IIFE: `if (VITE_LOKYY_SKIP_SPLASH === '1') return;` short-circuits the Hermes splash gate. Used only for visual-verification builds. Default OFF — Hermes splash unchanged. (This is in addition to Phase A's `.dark`-default patch in the bootstrap script.) | Etappe 1 / [#16](https://github.com/oliverhees/lokyy/issues/16) |
| `src/routes/{operations,swarm,swarm2,memory,files,profiles,terminal}.tsx` + `src/routes/chat/$sessionKey.tsx` + `src/routes/settings/index.tsx` | Phase D — page-frame reskin only (error/pending state Cards, outer container `bg-background text-foreground`, H1 → `text-2xl font-semibold tracking-tight`, lede → `text-sm text-muted-foreground`, indigo primary buttons). No logic edits. | Etappe 1 / [#17](https://github.com/oliverhees/lokyy/issues/17) |
| `src/screens/{dashboard/dashboard-screen.tsx, agents/operations-screen.tsx, swarm2/swarm2-screen.tsx, gateway/conductor.tsx, tasks/tasks-screen.tsx, jobs/jobs-screen.tsx}` | Phase D — high-visibility screen reskin: outer container + header `bg-card border-border`, H1 typography upgrade, primary chips/icons swap amber→indigo, "Hermes Workspace" wordmark in dashboard H1 swapped to "lokyy AI Operating System". No logic edits. | Etappe 1 / [#17](https://github.com/oliverhees/lokyy/issues/17) |
| `src/components/settings/settings-sidebar.tsx` | Phase D — active-state token swap (amber-tinted `--theme-accent-*` → Lokyy `bg-accent text-accent-foreground` + `bg-primary` indicator), H1 promoted to `text-2xl`. | Etappe 1 / [#17](https://github.com/oliverhees/lokyy/issues/17) |

**Not touched** (per Phase A brief): `src/scifi-theme.css` — only contains `[data-theme='scifi']` / `'scifi-light'` blocks, both outside the `__root.tsx` whitelist (dead code for the UI). Leaving untouched per read-only-on-non-whitelist convention.

**Not touched** (per Phase C brief): `src/screens/chat/components/chat-sidebar.tsx` (1314 LOC — Hermes sidebar). Parallel LokyyShell strategy means we never reskin this file in Etappe 1. Same for all mobile components (`MobileTabBar`, `MobileHamburgerMenu`, `MobilePageHeader`, `MobileTerminalInput`) — they retain Hermes mobile-nav-tab list. **Known follow-up:** `MobileTabBar`'s internal `MOBILE_NAV_TABS` array (`mobile-tab-bar.tsx:48-134`) is a second source of truth for mobile nav items, separate from `app-sidebar.tsx`. Either keep manually in sync (Phase D acceptable) or extract to a shared constant later.

*Updated as Etappe 1 reskinning progresses (Phase A–E, Issues #14–#18).*
