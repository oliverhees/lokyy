# Recon — Bildmaterial & Dokumentations-Inventar

> **Issue:** #9 (Step 2.6) — Recon: Bildmaterial & README inventarisieren
> **Analyst:** Mary (BMAD Business Analyst)
> **Datum:** 2026-05-14
> **Scope:** `/media/oliver/Volume1/eigene_projekte_neu/lokyy/lokyy-workspace/` — READ-ONLY
> **Output:** Replacement-Liste für Phase E (Reskin → Assets/Docs)

---

## 2.6 Bildmaterial & README-Inventar

### Methodik

- Glob über `public/**`, `docs/**`, `assets/**`, `screenshots/**` für alle Bildformate (`png|jpg|jpeg|webp|svg|ico|gif`).
- Grep (case-insensitive) für `hermes` in allen Markdown-Dateien bis Tiefe 3, plus `package.json`, `public/manifest.json`.
- Aktions-Kategorien:
  - **replace** — sichtbare Hermes-Marke, muss durch Lokyy-Asset ersetzt werden (Phase E blockierend).
  - **rewrite** — Doku-Datei muss komplett neu geschrieben/umgebrandet werden.
  - **partial-rewrite** — nur sichtbarer Branding-Anteil ersetzen, Code-Identifier bleiben (z. B. `hermes` CLI-Name).
  - **remove** — Asset wird gelöscht (Hermesworld-Game-Material, im Lokyy-Scope irrelevant).
  - **preserve** — verbleibt unverändert (Drittlogos, Lizenz, generische Avatare).
  - **placeholder** — Lokyy-Platzhalter bis finales Asset existiert.
  - **leave** — Code-/Spec-Datei, keine User-sichtbare Marke, Recherche-Aufwand vs. Nutzen schlecht.

---

### A. Asset-Tabelle — Phase-E-blockierende Visuals

#### A.1 Root-Branding (Favicon, Logo, Icon, Cover) — kritisch

| Pfad | Typ | Größe | Zweck | Lokyy-Aktion |
|------|-----|------:|-------|--------------|
| `public/favicon.svg` | svg | 2.5 KB | Browser-Tab Favicon (Vite default-Slot) | **replace** |
| `public/claude-favicon.ico` | ico | 1.8 KB | Klassisches `.ico` Favicon | **replace** |
| `public/apple-touch-icon.png` | png | 22 KB | iOS Home-Screen Icon | **replace** |
| `public/claude-icon.png` | png | 1.8 KB | App-Icon (klein) | **replace** |
| `public/claude-icon-192.png` | png | 25 KB | PWA Icon 192px (manifest.json) | **replace** |
| `public/claude-icon-512.png` | png | 132 KB | PWA Icon 512px (manifest.json) | **replace** |
| `public/claude-logo.png` | png | 1.3 MB | Haupt-Logo PNG | **replace** |
| `public/claude-crest.svg` | svg | 1.3 KB | Logo-Variante Vektor | **replace** |
| `public/claude-banner.png` | png | 12 KB | Banner Dark | **replace** |
| `public/claude-banner-light.png` | png | 8.7 KB | Banner Light | **replace** |
| `public/claude-avatar.png` | png | 84 KB | DA-Avatar PNG (Default-Assistant) | **replace** |
| `public/claude-avatar.webp` | webp | 16 KB | DA-Avatar WebP | **replace** |
| `public/claude-caduceus.png` | png | 202 KB | Hermes-Sigil (Caduceus) | **replace** |
| `public/cover.png` | png | 84 KB | Social-Cover-Bild (OG/README) | **replace** |
| `public/cover.webp` | webp | 85 KB | Social-Cover WebP | **replace** |
| `public/social-preview.png` | png | 84 KB | OG-Image / Social Share | **replace** |
| `public/logo-icon.png` | png | 50 KB | Sekundär-Logo | **replace** |
| `public/logo-icon.jpg` | jpg | 8.3 KB | Sekundär-Logo JPG | **replace** |
| `public/hermesworld-logo.svg` | svg | 3.4 KB | Hermesworld-Marke (sichtbar) | **replace** oder **remove** |
| `public/hermesworld-world.png` | png | 2.6 MB | Hermesworld Hero | **remove** (kein Lokyy-Scope) |
| `public/hermesworld-logos-reference.png` | png | 1.5 MB | Logo-Referenztafel | **remove** |
| `assets/icon.png` | png | 132 KB | Electron-Builder App-Icon (siehe `electron-builder.config.cjs`) | **replace** |

> **Hinweis:** `public/manifest.json` referenziert `/claude-icon-192.png` und `/claude-icon-512.png` und enthält die Strings `"Hermes Workspace"` (name), `"Hermes"` (short_name), `"Native web control surface for Hermes Agent"` (description) — 3 Hermes-Mentions. Diese JSON-Datei muss in Phase E ebenfalls aktualisiert werden (User-sichtbar via PWA-Install-Prompt).

#### A.2 Hermesworld-Asset-Pack (`public/assets/hermesworld/**`) — komplett entfernen

22 Dateien, gesamt ~6.3 MB. Vollständig Hermesworld-spezifisch (Game-Branding, Wave-A Source-Material, Zone-Hintergründe). Außerhalb Lokyy-Scope.

| Pfad | Typ | Größe | Zweck | Lokyy-Aktion |
|------|-----|------:|-------|--------------|
| `public/assets/hermesworld/art/hermesworld-app-icon.{png,svg,@2x.png,@3x.png}` | png/svg | 80 KB | Hermesworld App-Icon (4 Größen) | **remove** |
| `public/assets/hermesworld/art/hermesworld-logo-caduceus.png` + `.webp`/Badge/Favicon | png | 302 KB | Caduceus-Logo-Set | **remove** |
| `public/assets/hermesworld/art/hermesworld-logo-h.png` | png | 15 KB | H-Lockup | **remove** |
| `public/assets/hermesworld/art/hermesworld-logo-horizontal.{svg,png,@2x,@3x}` | png/svg | 433 KB | Horizontales Lockup (4) | **remove** |
| `public/assets/hermesworld/art/hermesworld-logo-stacked.{svg,png,@2x,@3x}` | png/svg | 1.0 MB | Gestapeltes Lockup (4) | **remove** |
| `public/assets/hermesworld/art/hermesworld-sigil.{svg,png,@2x,@3x}` | png/svg | 163 KB | Sigil (4) | **remove** |
| `public/assets/hermesworld/art/social-preview-hero.jpg` | jpg | 82 KB | OG Social-Preview Hermesworld | **remove** |
| `public/assets/hermesworld/v2/wave-a-source/{A03-A08-rerolls,all-images-contact-sheet}.png` | png | 3.6 MB | Source-Material | **remove** |
| `public/assets/hermesworld/video/{hero,world-demo}-poster.jpg` | jpg | 128 KB | Video-Poster | **remove** |
| `public/assets/hermesworld/zones/{cityscape,hero,zone-1..6}.jpg` | jpg | 449 KB | Zone-Hintergründe Game | **remove** |

#### A.3 Avatare (`public/avatars/`) — neutral, behalten

| Pfad | Typ | Größe | Zweck | Lokyy-Aktion |
|------|-----|------:|-------|--------------|
| `public/avatars/apollo.png` | png | 2.0 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/artemis.png` | png | 2.1 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/athena.png` | png | 2.0 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/chronos.png` | png | 2.2 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/eros.png` | png | 2.0 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/hermes.png` | png | 1.6 MB | Conductor-Agent-Avatar (`hermes` = Code-Identifier-Name, NICHT Visual-Branding) | **preserve** |
| `public/avatars/iris.png` | png | 2.1 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/nike.png` | png | 2.2 MB | Conductor-Agent-Avatar | **preserve** |
| `public/avatars/pan.png` | png | 2.0 MB | Conductor-Agent-Avatar | **preserve** |
| `public/ascii-portraits/*.txt` (16 Dateien inkl. `hermes.txt`) | txt | <1 KB ea | ASCII-Portraits für Terminal-UI | **preserve** (CLAUDE.md "Code-Identifier"-Regel) |
| `public/avatars-3d/README.md` | md | – | Placeholder-Doku | **partial-rewrite** (2 Hermes-Mentions) |

> Agent-Namen (`apollo`, `hermes`, `athena`, …) sind interne Conductor-Identifier und keine Hermes-Brand-Assets. Sie bleiben gemäß Branding-Regel `CLAUDE.md` ("Original names stay everywhere only code sees them").

#### A.4 Provider-Logos (`public/providers/`) — Drittmarken, behalten

| Pfad | Typ | Zweck | Lokyy-Aktion |
|------|-----|-------|--------------|
| `public/providers/{anthropic,kimi,minimax,nous,nousresearch,ollama,openai,openrouter,zhipu,atomic-chat}.png` | png | LLM-Provider-Logos (10 Dateien, Dark-Variante) | **preserve** |
| `public/providers/light/{...}.png` | png | Light-Variante (9 Dateien) | **preserve** |

19 Drittlogos. Markenrechtlich nicht zu modifizieren — bleiben unverändert.

#### A.5 Produkt-Screenshots — Phase E nachrangig

User-sichtbar nur in README. Inhalt zeigt Hermes-UI-Pre-Reskin — werden mit Lokyy-UI-Screenshots überschrieben, sobald Reskin live ist (Phase F/G, nicht E).

| Pfad | Typ | Größe | Zweck | Lokyy-Aktion |
|------|-----|------:|-------|--------------|
| `public/screenshots/{dashboard,chat,agent-hub,files,providers,command-palette,skills-browser}.png` + `-v3` + `chat-agent-hub` (10 Dateien) | png | 0.2–0.8 MB | README-Hero-Screenshots | **placeholder** (Lokyy-Re-Render in Phase F) |
| `public/screenshots/gallery/{agents-config,cron-manager,mission-wizard,mobile-*,skills-browser,tasks-board}.png` (7 Dateien) | png | 0.2–0.8 MB | README-Gallery | **placeholder** |
| `public/screenshots/skills-browser.jpg` | jpg | 65 KB | README-Asset | **placeholder** |
| `docs/screenshots/*.png` (13 Dateien: chat, conductor, dashboard, files, jobs, memory, settings, skills, splash, tasks, terminal, brand-pack-*, playground-*, asset-generation-*) | png | 0.06–0.7 MB | Doku-Screenshots | **placeholder** oder **remove** (FEATURES-INVENTORY-Anhang) |
| `screenshots/{hermes-world-landing-pass,hermesworld-accessibility-desktop,hermesworld-accessibility-mobile,SciFi,scifi-theme}.png` | png | 31 KB–1.2 MB | Hermesworld-Theme-Snapshots | **remove** |
| `docs/pr-screenshots/wave-chat-panels/{desktop,mobile}.png` | png | 33 KB–698 KB | PR-Beweis-Screenshots | **leave** (historisch) |
| `docs/images/star-history.png` | png | 512 KB | GitHub-Star-History | **placeholder** (Lokyy-eigene Kurve) |
| `docs/hermesworld/reference-images/*` (5 Dateien, ~8.9 MB) | png/jpeg | – | Hermesworld-Game-Referenzen | **remove** |
| `docs/hermesworld/screenshots-2026-05-06/{agora-hud-live,agora-hud-side-by-side}.png` | png | 11 KB–1.7 MB | Game-Audit-Screenshots | **remove** |

---

### B. Doku-Tabelle — Hermes-Branding in Markdown

#### B.1 Root-Docs (User-sichtbar)

| Datei | Hermes-Mentions | Lokyy-Aktion | Begründung |
|-------|-----------------:|--------------|-----------|
| `README.md` | **123** | **rewrite** | Vollständig Hermes-gebrandet, Hero + Screenshots + Tagline. Phase-E-Hauptarbeit. |
| `CONTRIBUTING.md` | 4 | **partial-rewrite** | Repo-/Setup-Hinweise — Hermes-Name in User-sichtbaren Stellen ersetzen. |
| `SECURITY.md` | 4 | **partial-rewrite** | Vulnerability-Report-Adresse + Projekt-Name. |
| `CHANGELOG.md` | 6 | **leave** | Historischer Hermes-Verlauf — bleibt als Upstream-Historie erhalten; Lokyy-Changelog-Block wird _ergänzt_, nicht überschrieben. |
| `FEATURES-INVENTORY.md` | 24 | **partial-rewrite** | Feature-Liste — User-sichtbar in Release-Notes verlinkt; "Hermes" → "Lokyy" bei sichtbaren Stellen, technische CLI-Verweise (`hermes gateway`) bleiben. |
| `FUTURE-FEATURES.md` | 0 | **leave** | Keine Hermes-Mentions, kein Touch nötig. |
| `LICENSE` | — | **preserve verbatim** | **OFF-LIMITS** — Hermes MIT-Lizenz-Copyright bleibt 1:1 unverändert (CLAUDE.md Hard Constraint). |

#### B.2 docs/* (gemischt — User- + Entwickler-sichtbar)

| Datei | Mentions | Lokyy-Aktion |
|-------|---------:|--------------|
| `docs/hermes-workspace-naming-contract.md` | 18 | **partial-rewrite** (Naming-Contract erweitern um Lokyy-vs-Hermes-Regel) |
| `docs/AGENT-PAIRING.md` | 27 | **leave** (Entwickler-Spec, "hermes" = Conductor-Agent-Name) |
| `docs/claude-openai-compat-spec.md` | 21 | **leave** (Internal API-Spec) |
| `docs/multi-gateway-pool-spec.md` | 14 | **leave** |
| `docs/swarm2-memory-framework-spec.md` | 27 | **leave** |
| `docs/swarm2-autopilot-orchestration-spec.md` | 8 | **leave** |
| `docs/swarm2-agent-ide-spec.md` | 5 | **leave** |
| `docs/swarm2-worker-lifecycle-compaction-spec.md` | 1 | **leave** |
| `docs/tool-artifacts-context-plan.md` | 12 | **leave** |
| `docs/troubleshooting.md` | 13 | **partial-rewrite** (User-sichtbar — Setup-Anweisungen) |
| `docs/docker.md` | 30 | **partial-rewrite** (Compose-Beispiele zeigen `hermes` Container-Namen — sichtbar im Terminal) |
| `docs/desktop-update-system.md` | 7 | **partial-rewrite** (App-Update-UI-Strings) |
| `docs/agent-authored-ui-state.md` | low | **leave** |
| `docs/conductor-bug-log.md` | low | **leave** (historische Log-Datei) |
| `docs/release-2.1.0.md` | – | **leave** (historischer Release-Note) |
| `docs/i18n-contributing.md` | low | **partial-rewrite** (Contributor-Doc, User-sichtbar) |

#### B.3 docs/hermesworld/** — komplett removen

19 Dateien (`MASTER-PLAN.md`, `PROMPT-LIBRARY.md`, `ART-BIBLE-REALISM-LOOP.md`, `GUILDS-AGENTS-COMPANION-ECONOMY.md`, `INGAME-TARGET-SPEC.md`, `VISION-BEST-AI-MMO.md` …). Hermesworld ist ein eigenständiges Game-Projekt, das im Lokyy-Distro-Fork keinen Platz hat.

**Aktion:** `**remove**` (ganzes Verzeichnis `docs/hermesworld/` + `screenshots/hermes*` + `screenshots/hermes-world-landing-pass.png` + `screenshots/SciFi.png` + `screenshots/scifi-theme.png`).

#### B.4 Sub-Project READMEs

| Datei | Mentions | Lokyy-Aktion |
|-------|---------:|--------------|
| `docs/swarm/README.md` | 6 | **leave** (Entwickler-Doku) |
| `docs/swarm/QUICKSTART.md` | 8 | **partial-rewrite** (User-sichtbarer Quickstart) |
| `docs/swarm/ARCHITECTURE.md` | 3 | **leave** |
| `docs/swarm/ROLES.md` | 1 | **leave** |
| `docs/swarm/SKILLS.md` | 4 | **leave** |
| `docs/playground/README.md` | 16 | **partial-rewrite** (User-sichtbar) |
| `docs/requirements/dirsize-tool.md` | 3 | **leave** |
| `playground-ws-worker/README.md` | 5 | **leave** (Worker-internal) |
| `public/avatars-3d/README.md` | 2 | **partial-rewrite** |
| `memory/2026-05-04.md`, `memory/2026-05-05.md` | 4 + 5 | **leave** (Agent-Memory-Snapshots, nicht User-facing) |

#### B.5 Code-Manifeste mit Brand-Strings

| Datei | Sichtbare Hermes-Strings | Lokyy-Aktion |
|-------|--------------------------|--------------|
| `public/manifest.json` | `"Hermes Workspace"`, `"Hermes"`, `"Native web control surface for Hermes Agent"` | **partial-rewrite** (PWA-Install-Prompt — User-sichtbar) |
| `package.json` | `"name": "hermes-workspace"`, `"description": "Desktop workspace for Hermes Agent — chat, orchestration, and multi-agent coding pipelines"` | **leave** (Code-Identifier per CLAUDE.md Branding-Regel — `name`/`description` sind paketbezogen, NICHT visuell. Description kommt nur in npm/registry zum Tragen, der Distro-Fork wird nicht published.) |

---

### C. Priorisierung für Phase E

**Blocker (vor Phase-E-Abschluss zwingend erledigt):**

1. **Logo-Set** — `claude-logo.png`, `claude-crest.svg`, `logo-icon.png/.jpg`, `hermesworld-logo.svg` → Lokyy-Logo (Master + Mono + Stacked).
2. **Favicon-Set** — `favicon.svg`, `claude-favicon.ico`, `apple-touch-icon.png`, `claude-icon.png`, `claude-icon-192.png`, `claude-icon-512.png` → Lokyy-Favicon (alle Größen).
3. **PWA-Manifest** — `public/manifest.json` (3 Hermes-Strings) → Lokyy name/short_name/description.
4. **Banner / OG / Cover** — `claude-banner*.png`, `cover.{png,webp}`, `social-preview.png` → Lokyy-Visual.
5. **Default-DA-Avatar** — `claude-avatar.{png,webp}`, `claude-caduceus.png` → Lokyy-DA-Avatar.
6. **Electron-Builder-Icon** — `assets/icon.png` → Lokyy-Icon (Desktop-App-Build).
7. **README.md** — vollständige Neufassung mit Lokyy-Tagline, Lokyy-Screenshots-Platzhalter, Lokyy-Repo-URL.

**Nachrangig (Phase F oder später):**

- Produkt-Screenshots (`public/screenshots/**`, `docs/screenshots/**`) — Re-Render gegen Lokyy-UI nach Reskin-Live.
- `CONTRIBUTING.md`, `SECURITY.md`, `FEATURES-INVENTORY.md` — partial rewrites.
- `docs/docker.md`, `docs/troubleshooting.md` — User-sichtbare Setup-Strings.

**Komplett-Remove (kann auch Phase E erledigen, kosmetisch unproblematisch):**

- `public/assets/hermesworld/**` (22 Dateien, ~6.3 MB)
- `docs/hermesworld/**` (19 Dateien + 5 Reference-/Screenshot-Bilder, ~12 MB)
- `screenshots/hermes-world-landing-pass.png`, `screenshots/hermesworld-accessibility-*`, `screenshots/SciFi.png`, `screenshots/scifi-theme.png`

**OFF-LIMITS (CLAUDE.md Hard Constraint):**

- **`LICENSE`** → **preserve verbatim**. Hermes MIT-Copyright bleibt unverändert. Lokyy-Attribution lebt in der Root-`NOTICE`-Datei (außerhalb `lokyy-workspace/`).
- Code-Identifier in `package.json` (`name`, theme-IDs, agent-`hermes`-Avatar-Filename, ASCII-Portrait `hermes.txt`, CLI-Verweise wie `hermes gateway` in Specs) → **leave** (interne Bezeichner, nicht User-sichtbar).

---

### D. Zusammenfassung — Volumen

| Kategorie | Dateien | Aktion |
|-----------|--------:|--------|
| Phase-E-blockierende Visuals (Logo/Favicon/Avatar/Cover/Manifest) | 22 + manifest.json | replace / partial-rewrite |
| Hermesworld-Asset-Pack zum Entfernen | 22 | remove |
| Hermesworld-Doku zum Entfernen | 19 docs + 7 Bilder | remove |
| Produkt-Screenshots (Re-Render Phase F) | 31 | placeholder |
| Drittlogos / Avatare / ASCII (behalten) | 9 + 19 + 16 = 44 | preserve |
| Markdown-Rewrites (Root) | 4 (`README`, `CONTRIBUTING`, `SECURITY`, `FEATURES-INVENTORY`) | rewrite / partial-rewrite |
| Markdown-Rewrites (docs) | 6 | partial-rewrite |
| Markdown — leave (Specs/Logs) | 24+ | leave |
| **LICENSE** | 1 | **preserve verbatim (Hard Constraint)** |

**Gesamt-Reduktion durch Removes:** ~18 MB Repo-Größe (Hermesworld-Assets + Game-Docs).
**Kritischer Pfad Phase E:** Logo-Set + Favicon-Set + Manifest + README + Default-DA-Avatar.
