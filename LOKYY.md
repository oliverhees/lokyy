# LOKYY.md — Touched Upstream Files

This file tracks every upstream Hermes Workspace file that Lokyy modifies.
It is the merge-conflict early-warning system: a long list = too deep a cut.

**Rule:** If this list exceeds ~8–10 files, pause, rethink architecture, ask Oliver.

---

## Status

**Etappe 1 (Reskinning):** In progress — Step 1.2 done. Inner workspace cloned, **pinned to `v2.3.0`**, branch `lokyy/main` active. No upstream files touched yet — reskin work starts after Checkpoint 2.

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
| *(none yet)* | Reskin starts after [Issue #13](https://github.com/oliverhees/lokyy/issues/13) (Checkpoint 2) | — |

*Updated as Etappe 1 reskinning progresses (Phase A–E, Issues #14–#18).*
