# ADR-001 — How `lokyy-workspace/` is integrated into the Lokyy mono-repo

**Status:** Accepted
**Date:** 2026-05-14
**Decision-maker:** Orchestrator (Claude) — pending Oliver's veto
**Issue:** [#2](https://github.com/oliverhees/lokyy/issues/2)

---

## Context

The Lokyy project is structured as a mono-repo. The outer repo (`oliverhees/lokyy`) holds orchestration: `CLAUDE.md`, the Etappe-1 brief, the `docs/` tree (diary, decisions, recon-findings), `LOKYY.md`, `NOTICE`, and BMAD configuration.

Inside that mono-repo lives `lokyy-workspace/` — a **distribution fork of Hermes Workspace** (`outsourc-e/hermes-workspace`, pinned to `v2.3.0`). The fork is purely visual: all functional logic comes from upstream. We will **merge upstream releases regularly** (`v2.3 → v2.4 → ...`).

Question: how do we embed the inner workspace fork inside the outer mono-repo?

## Options considered

### A — Git submodule
The outer repo references the inner workspace fork as a submodule. Each commit on the outer repo pins to a specific submodule SHA.

- ➕ Sharper boundary: outer repo never accidentally stages workspace files.
- ➕ Versioning is explicit: the outer repo records which workspace SHA it was tested against.
- ➖ Submodule UX is famously bad: `git clone` doesn't recurse without `--recursive`, contributors forget `git submodule update`, IDE tooling breaks.
- ➖ Merging upstream becomes more friction: you must update the submodule, push the workspace, then commit the SHA bump on the outer repo. Two pushes per upstream merge.
- ➖ Branch coordination is awkward: outer repo `main` vs inner repo `lokyy/main` can drift silently.

### B — Subtree merge
The inner workspace lives inside the outer repo as a true subdirectory whose history is grafted in via `git subtree`. Upstream merges become `git subtree pull`.

- ➕ Single repo, single clone — best contributor UX.
- ➖ The outer repo's history becomes enormous (it inherits the entire Hermes workspace history).
- ➖ Subtree commands are obscure. Most contributors will not know them.
- ➖ Conflicts during `subtree pull` are harder to reason about than plain merges.

### C — Nested independent repo, ignored by outer (CHOSEN)
The inner workspace is a separate, independent Git repo physically located inside the outer repo's working tree. The outer repo `.gitignore` lists `/lokyy-workspace/`, so the outer repo never sees the inner contents. The inner repo has its own `lokyy/main` branch and its own `upstream` remote pointing at `outsourc-e/hermes-workspace`.

- ➕ Clean conceptual model: outer = orchestration, inner = product code.
- ➕ Upstream merges happen entirely inside the inner repo with vanilla `git fetch upstream && git merge upstream/main`. No submodule choreography.
- ➕ The outer repo stays tiny — it's a project notebook, not a code repo.
- ➕ Contributors clone two repos explicitly, which makes the architectural split obvious.
- ➖ The outer repo can't pin "this orchestration commit was tested against this workspace SHA" automatically — but we document the pinned version in `LOKYY.md` and the README, which is sufficient for our purposes (we're not shipping the outer repo as a product).
- ➖ Two pushes for cross-cutting changes — acceptable trade-off given we expect most changes to live entirely in one or the other.

## Decision

**Option C — nested independent repo with outer `.gitignore`.**

Rationale: the outer repo is fundamentally a different kind of artifact (project orchestration / brief / diary) than the inner repo (deployable product code). Submodules and subtrees both leak the inner code's complexity up into the outer's workflow. Keeping them as two independent repos with a documented physical layout matches how we actually think about them.

## Consequences

- Outer repo's `.gitignore` must list `/lokyy-workspace/`.
- The inner repo (`lokyy-workspace/`) gets its own `origin` remote — separate decision (deferred — see [Question O1](#open-questions) below).
- `LOKYY.md` documents the pinned upstream version and tracks every Lokyy-touched upstream file.
- All Etappe-1 issues that touch product code (Phase A–E, recon work) operate **inside** `lokyy-workspace/`. Setup, planning, and documentation operate in the **outer** repo.
- Workflow for upstream merges (in `lokyy-workspace/`):
  ```bash
  cd lokyy-workspace
  git fetch upstream
  git merge upstream/main --no-ff
  ```

## Open questions

- **O1:** Does the inner workspace fork need its own `origin` on GitHub (e.g. `oliverhees/lokyy-workspace`)? Or is having only `upstream` and pushing nowhere acceptable until the team grows? — Defer to Oliver after Issue #2 closes. For now, no `origin` is set on the inner repo; it's a local-only working copy with `upstream` for fetching releases.

## Revisit triggers

- If Oliver wants the outer repo to be reproducible without separate workspace setup → reconsider subtree.
- If contributors keep forgetting to update the workspace clone → reconsider submodule.
- If upstream pace becomes unmanageable → reconsider whether forking is the right strategy at all.
