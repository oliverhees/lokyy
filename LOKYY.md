# LOKYY.md — Touched Upstream Files

This file tracks every upstream Hermes Workspace file that Lokyy modifies.
It is the merge-conflict early-warning system: a long list = too deep a cut.

**Rule:** If this list exceeds ~8–10 files, pause, rethink architecture, ask Oliver.

---

## Status

**Etappe 1 (Reskinning):** Phase A + Phase B done (Steps 3.2 + 3.3, Issues [#14](https://github.com/oliverhees/lokyy/issues/14) + [#15](https://github.com/oliverhees/lokyy/issues/15)). Inner workspace pinned to `v2.3.0`, branch `lokyy/main` active. Token-Layer applied additively across all 8 themes, Tailwind `@theme inline` block exposes Shadcn vars as utility classes, 13 existing UI components restyled, 8 new Shadcn-canonical components built on Base UI. Hermes `--theme-*` declarations remain untouched.

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

**Not touched** (per Phase A brief): `src/scifi-theme.css` — only contains `[data-theme='scifi']` / `'scifi-light'` blocks, both outside the `__root.tsx` whitelist (dead code for the UI). Leaving untouched per read-only-on-non-whitelist convention.

*Updated as Etappe 1 reskinning progresses (Phase A–E, Issues #14–#18).*
