# LOKYY.md — Touched Upstream Files

This file tracks every upstream Hermes Workspace file that Lokyy modifies.
It is the merge-conflict early-warning system: a long list = too deep a cut.

**Rule:** If this list exceeds ~8–10 files, pause, rethink architecture, ask Oliver.

---

## Status

**Etappe 1 (Reskinning):** Phase A + B + C + D + **E done** (Steps 3.2–3.6, Issues [#14](https://github.com/oliverhees/lokyy/issues/14)–[#18](https://github.com/oliverhees/lokyy/issues/18)). Inner workspace pinned to `v2.3.0`, branch `lokyy/main` active. Token-Layer + `@theme inline` + 13 restyled + 8 new components + LokyyShell hinter env-flags + 16 page-files frame-reskinned über 12 Domains + **README/CONTRIBUTING/SECURITY rewritten + Lokyy logo asset set (SVG + 6 PNG sizes + OG) + manifest.json + HTML head + Hermesworld dirs deleted (~24 MB freed)**. Hermes-Marketing-Routen bewusst NICHT reskinned — Brief-konformes "hide" via Sidebar-Omission. LICENSE bitweise unangetastet (MIT, Eric/outsourc-e), interne Code-Identifiers (`hermes-workspace` package name, `claude-*` Theme-IDs, Component-Namen) intakt. Beide env flags default OFF.

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
| `src/styles.css` | Phase A — bridge block in each of 8 `[data-theme='claude-*']`. Phase B — `@theme inline` block added at top. **Phase A fixup ([#25](https://github.com/oliverhees/lokyy/issues/25)) — Hermes `--theme-*` tokens now aliased to Lokyy bridge vars (`--theme-bg: var(--background)` etc.) so every Hermes-styled component automatically renders with Lokyy colors.** 23 aliases per theme × 8 themes inside the existing LOKYY-BRIDGE markers. Hermes `--theme-*` variable NAMES stay (preserves component refs); only their VALUES now resolve through the Lokyy bridge. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) + [#15](https://github.com/oliverhees/lokyy/issues/15) + [#25](https://github.com/oliverhees/lokyy/issues/25) |
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
| `README.md` + `CONTRIBUTING.md` + `SECURITY.md` | Phase E — README rewritten as Lokyy (123 → ~20 attribution-only Hermes mentions). CONTRIBUTING + SECURITY de-Hermes-ed; SECURITY uses GitHub private vulnerability reporting (no placeholder email). Upstream MIT attribution prominent. | Etappe 1 / [#18](https://github.com/oliverhees/lokyy/issues/18) |
| `public/lokyy.svg` + `public/lokyy-{16,32,48,180,192,512}.png` + `public/lokyy-og.png` | Phase E — **new files** generated from Sally's logo spec via `scripts/generate-lokyy-icons.ts` (new outer-repo Playwright tool). Lokyy indigo `#6E63F2`, transparent backgrounds for icon set, dark indigo bg for OG. | Etappe 1 / [#18](https://github.com/oliverhees/lokyy/issues/18) |
| `public/{claude-avatar.png,.webp,claude-caduceus.png,claude-crest.svg,claude-logo.png,claude-icon*.png,claude-favicon.ico,favicon.svg,apple-touch-icon.png,logo-icon.{png,jpg},claude-banner*.png,cover.{png,webp},social-preview.png,hermesworld-logo.svg}` + `assets/icon.png` | Phase E — **byte content replaced** with Lokyy variants. Filenames stay because code references them as identifiers (per CLAUDE.md branding rule). `hermesworld-logo.svg` is now Lokyy-bytes — filename slightly misleading but rename would touch code refs, accepted trade-off. | Etappe 1 / [#18](https://github.com/oliverhees/lokyy/issues/18) |
| `public/manifest.json` + `src/routes/__root.tsx` (head meta) | Phase E — manifest name/short_name `lokyy`, theme #6E63F2, bg #0B0D14, icons point at new lokyy-*.png. `__root.tsx` head: `<title>lokyy</title>`, og:image/twitter:image → `/lokyy-og.png`, theme-color #0B0D14, icon links → lokyy.svg + lokyy-32.png + lokyy-180.png, themeColorScript map for claude-nous → Lokyy dark bg. | Etappe 1 / [#18](https://github.com/oliverhees/lokyy/issues/18) |
| `docs/hermesworld/**` + `public/assets/hermesworld/**` + `screenshots/hermesworld-*.png` | Phase E — **deleted** (~24 MB). 48 markdown/data files + 40 assets + 5 screenshots. Brief-Recommendation. Hermes-marketing routes (`/world` etc.) still exist as code but render with broken image refs — accepted, since brief said "hide" those routes from the sidebar and we did. | Etappe 1 / [#18](https://github.com/oliverhees/lokyy/issues/18) |

**Not touched** (per Phase A brief): `src/scifi-theme.css` — only contains `[data-theme='scifi']` / `'scifi-light'` blocks, both outside the `__root.tsx` whitelist (dead code for the UI). Leaving untouched per read-only-on-non-whitelist convention.

**Not touched** (per Phase C brief): `src/screens/chat/components/chat-sidebar.tsx` (1314 LOC — Hermes sidebar). Parallel LokyyShell strategy means we never reskin this file in Etappe 1. Same for all mobile components (`MobileTabBar`, `MobileHamburgerMenu`, `MobilePageHeader`, `MobileTerminalInput`) — they retain Hermes mobile-nav-tab list. **Known follow-up:** `MobileTabBar`'s internal `MOBILE_NAV_TABS` array (`mobile-tab-bar.tsx:48-134`) is a second source of truth for mobile nav items, separate from `app-sidebar.tsx`. Either keep manually in sync (Phase D acceptable) or extract to a shared constant later.

*Updated as Etappe 1 reskinning progresses (Phase A–E, Issues #14–#18).*
