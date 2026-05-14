# Lokyy Orchestration Scripts

Small tools that run from the **outer** repo. They orchestrate or verify; they don't ship product.

## `verify-ui.ts` — Visual verification via Playwright

Headless-Chromium snapshot of a running route. Used in every Reskin-Issue's DoD from Phase A onward.

**Why Playwright and not Interceptor?**
- Global PAI rule (`~/.claude/CLAUDE.md`): "Interceptor for ALL web verification."
- Linux dev box: Interceptor CLI not installed (Mac-centric setup).
- Oliver's project-scoped override in [Issue #22](https://github.com/oliverhees/lokyy/issues/22): use Playwright.
- Trade-off: Playwright is headless Chromium (CDP-driven) — can in rare cases miss rendering issues real Chrome would catch. For a deterministic CSS-token reskin, this risk is acceptable.

### Setup (one-time)

```bash
cd /media/oliver/Volume1/eigene_projekte_neu/lokyy
bun install                       # installs playwright in outer node_modules
bunx playwright install chromium  # downloads chromium browser (~150MB)
```

### Usage

```bash
# Default viewport (1440x900), output goes to ./docs/verification-shots/shot-<ts>.png
bun run scripts/verify-ui.ts http://localhost:3002/

# Named output
bun run scripts/verify-ui.ts http://localhost:3002/ ./docs/verification-shots/dashboard-baseline.png

# Full-page (scrolling pages)
bun run scripts/verify-ui.ts http://localhost:3002/dashboard ./docs/verification-shots/dashboard-full.png --full

# Custom viewport
bun run scripts/verify-ui.ts http://localhost:3002/ shot.png --width 1920 --height 1080
```

### What it reports

For each run:

- HTTP status code
- Page title
- Resolved screenshot path
- Elapsed time
- Console errors (up to 10)
- Failed network requests (up to 10)

Non-zero exit if HTTP status >= 400.

### Workflow for Reskin Issues (Phase A onward)

Before claiming an issue is done, attach **before** and **after** screenshots:

```bash
# Before — on lokyy/main without your changes
bun run scripts/verify-ui.ts http://localhost:3002/dashboard \
  ./docs/verification-shots/dashboard-pre-phaseA.png

# After — once your changes are in
bun run scripts/verify-ui.ts http://localhost:3002/dashboard \
  ./docs/verification-shots/dashboard-post-phaseA.png

# Post both into the GitHub issue
gh issue comment <N> --repo oliverhees/lokyy \
  --body "Before: ![](./docs/verification-shots/dashboard-pre-phaseA.png) After: ![](./docs/verification-shots/dashboard-post-phaseA.png)"
```

(GitHub renders relative-path images from the default branch — push first, then comment.)

### Notes

- Screenshots are committed to `docs/verification-shots/` so they survive in the repo and history.
- The dev server must be running first (`cd lokyy-workspace && pnpm dev`). The script does not start it.
- For multi-route verification, call the script multiple times. A future helper could batch a YAML list of routes — defer until needed.
