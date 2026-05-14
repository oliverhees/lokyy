# LOKYY.md — Touched Upstream Files

This file tracks every upstream Hermes Workspace file that Lokyy modifies.
It is the merge-conflict early-warning system: a long list = too deep a cut.

**Rule:** If this list exceeds ~8–10 files, pause, rethink architecture, ask Oliver.

---

## Status

**Etappe 1 (Reskinning):** Phase A done (Step 3.2, [Issue #14](https://github.com/oliverhees/lokyy/issues/14)) — inner workspace pinned to `v2.3.0`, branch `lokyy/main` active. Token-Layer + Tailwind-Theme applied additively across all 8 themes. Hermes `--theme-*` declarations untouched.

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
| `src/styles.css` | Phase A — Lokyy Shadcn-token bridge block appended inside each of the 8 `[data-theme='claude-*']` blocks (4 dark + 4 light); global `--radius` scale (sm/md/lg/xl) added once in top-level `:root`. Hermes `--theme-*` untouched. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |
| `src/routes/__root.tsx` | Phase A — bootstrap `themeScript` now forces `.dark` class on `<html>` when no theme is stored (Lokyy dark-default). Whitelist + theme-switch logic unchanged. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |
| `package.json` | Phase A — new dep `tw-animate-css ^1.4.0` (the only Etappe-1-allowed new dep, prereq for Shadcn-style animations in later phases). | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |
| `pnpm-lock.yaml` | Phase A — lockfile sync for `tw-animate-css`. | Etappe 1 / [#14](https://github.com/oliverhees/lokyy/issues/14) |

**Not touched** (per Phase A brief): `src/scifi-theme.css` — only contains `[data-theme='scifi']` / `'scifi-light'` blocks, both outside the `__root.tsx` whitelist (dead code for the UI). Leaving untouched per read-only-on-non-whitelist convention.

*Updated as Etappe 1 reskinning progresses (Phase A–E, Issues #14–#18).*
