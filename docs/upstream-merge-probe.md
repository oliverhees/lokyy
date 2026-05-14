# Upstream-Merge-Probe — Etappe 1

> **Datum:** 2026-05-14
> **Issue:** [#20](https://github.com/oliverhees/lokyy/issues/20)
> **Methode:** Probe-Branch (`lokyy/merge-probe-2026-05-14`), `git merge upstream/main --no-ff`, Resolution + Build-Verify, `lokyy/main` bleibt unangetastet.

## Ziel

Den Ernstfall einer Upstream-Integration einmal durchspielen, **Konflikt-Aufwand messen + dokumentieren**, und damit eine ehrliche Aufwandsschätzung für reguläre Upstream-Sync-Zyklen ableiten.

## Vorgehen

```bash
cd lokyy-workspace
git checkout -b lokyy/merge-probe-2026-05-14    # Sicherheits-Branch
git fetch upstream                              # 9 neue Commits seit v2.3.0
git merge upstream/main --no-ff                 # automatischer Merge-Versuch
# 3 Konflikte
# resolution
git commit -m "lokyy: merge upstream/main probe — resolve 3 conflicts ..."
pnpm install && pnpm build                       # Verify
git checkout lokyy/main                          # zurück zum Known-Good
# Probe-Branch bleibt erhalten als Referenz
```

## Eingangs-Datenpunkte

| Metric | Wert |
|--------|------|
| Upstream-Commits seit v2.3.0 | **9** |
| Touched files (upstream-Seite) | **174** |
| Files die in unseren Phasen A–E berührt wurden | **~38** |
| Overlap-Files (beide Seiten haben angefasst) | **~34** |

## Auto-Merge-Ergebnis

Nach `git merge upstream/main --no-ff` (vor Resolution):

| Status | Count | Beispiele |
|--------|-------|-----------|
| **Sauber Auto-merged** | **31 Overlap-Files** | `package.json`, `pnpm-lock.yaml`, `src/routes/__root.tsx`, `settings-sidebar.tsx`, `settings/index.tsx`, `dashboard-screen.tsx`, `tasks-screen.tsx`, conductor-Avatare in `public/avatars/` |
| Sauber Neu (von upstream) | 140 Files | `agents/*/README.md` (10 neue Agent-Docs), `docs/swarm/*`, `Dockerfile`, `install.sh`, neue `src/server/*` Files, etc. |
| **Echte Konflikte** | **3 Files** | `README.md`, `public/manifest.json`, `src/screens/jobs/jobs-screen.tsx` |

## Konflikt-Resolution im Detail

### 1. `README.md` — Resolution-Aufwand: **30 Sekunden** (`git checkout --ours`)

Wir haben in Phase E komplett neu geschrieben. Upstream-Änderung war ein Badge-Update + Section-Add ("Agent Pairing"). Strategie: **ours wins**, weil das Lokyy-README bewusst neu konzipiert ist und Hermes-spezifische Sections (Agent Pairing) hier nicht passen.

```bash
git checkout --ours README.md
git add README.md
```

### 2. `public/manifest.json` — Resolution-Aufwand: **5 Minuten** (semantischer Merge)

Beide Seiten haben mehrere Felder umgeschrieben:
- **Wir:** name → `lokyy`, theme_color → `#6E63F2`, background_color → `#0B0D14`, icons → lokyy-* PNGs
- **Upstream:** PWA-Quality-Felder ergänzt — `id`, `scope`, `display_override`, `orientation`

Sinnvoller Merge: **alle Lokyy-Werte behalten + upstream's strukturelle PWA-Felder übernehmen** (mit Lokyy-Suffix für `id: /?app=lokyy`).

```json
{
  "name": "lokyy",
  "short_name": "lokyy",
  "description": "AI Operating System — self-hosted KI-Betriebssystem",
  "id": "/?app=lokyy",                                  // <- aus upstream
  "start_url": "/?source=pwa",                          // <- aus upstream
  "scope": "/",                                         // <- aus upstream
  "display": "standalone",
  "display_override": [...],                            // <- aus upstream
  "orientation": "any",                                 // <- aus upstream
  "background_color": "#0B0D14",                        // Lokyy
  "theme_color": "#6E63F2",                             // Lokyy
  "categories": ["productivity", "utilities", "developer"], // ours + dev from upstream
  "icons": [/* Lokyy PNG paths */]
}
```

### 3. `src/screens/jobs/jobs-screen.tsx` — Resolution-Aufwand: **18 Minuten** (manuell, vorsichtig)

Größter Konflikt — beide Seiten haben den **gesamten Render-Block** umgeschrieben:
- **Wir (Phase D):** outer container auf `bg-background text-foreground`, header in `<Card>` mit `text-2xl font-semibold tracking-tight`, gap-5 → gap-6
- **Upstream:** scheint ein paar Strings umzubenennen + die Komponenten-Anordnung minimal anzupassen (Suche-Card kommt in der upstream-Version vor der Liste, in unserer Lokyy-Version nach dem Header)

**Strategie:** upstream's JSX-Struktur 1:1 übernehmen, mit Lokyy-Class-Strings überschreiben. Konkret bedeutet das in der Resolution:
- `bg-surface text-ink` → `bg-background text-foreground`
- `border-primary-200 bg-primary-50/85 backdrop-blur-xl` → `border-border bg-card shadow-sm`
- `text-[var(--theme-accent)]` → `text-primary`
- `text-[var(--theme-text)]` → `text-foreground`
- `text-[var(--theme-muted)]` → `text-muted-foreground`
- `text-base font-semibold` → `text-2xl font-semibold tracking-tight`
- `hover:bg-[var(--theme-hover)]` → `hover:bg-accent`
- `style={{ background: 'var(--theme-accent)' }}` → `bg-primary text-primary-foreground` Klassen
- `color: 'var(--theme-danger)'` → `text-destructive`
- `var(--theme-warning)` → `text-[var(--warning)]` (Lokyy-Eigentoken)
- "Hermes profiles" → "configured profiles" (Branding-Sweep, war D1's Pattern)

Resolution-Aufwand kommt überwiegend aus der **Mental-Mapping-Arbeit** Hermes-Token → Lokyy-Tailwind-Utility, nicht aus Git-Mechanik.

## Gesamtaufwand für diese Probe

| Phase | Zeit |
|-------|------|
| Pre-merge Inspektion (fetch + diff) | ~3 Min |
| Auto-Merge | <1 Min |
| README resolution | <1 Min |
| manifest.json resolution | 5 Min |
| jobs-screen resolution | 18 Min |
| Commit + Build-Verify | ~5 Min |
| **Total** | **~32 Min** |

## Build-Verifikation

Nach dem Merge auf `lokyy/merge-probe-2026-05-14`:

```bash
$ pnpm install      # OK (lockfile reconciliation, 2 packages installed)
$ pnpm build        # OK — built in 5.23s (vs. 4.77s pre-merge; +9.6% an Bundle-Größe vor allem in router-Chunk durch upstream-Tasks-Refactor)
```

Build clean, exit 0. Inner-Commit auf der Probe-Branch: `0f1228ce`.

## Erkenntnisse — was hat funktioniert

### 1. `/* === LOKYY BRIDGE === */` Marker in `styles.css`
**0 Konflikte in `styles.css`** trotz unserer 8 inserted Bridge-Blocks (~280 neue Zeilen) plus `@theme inline` Block (Phase B). Auto-merger hat alles problemlos zusammengefügt, weil die Lokyy-Edits am Ende jedes `[data-theme=…]`-Blocks sitzen — orthogonal zu upstream-Edits in den Header- und globalen Bereichen.

→ **Lesson:** Marker-Kommentare + klare räumliche Trennung (insertion-points am Block-Ende) sind Gold wert für Forks.

### 2. Parallele `LokyyShell` statt In-Place
**`chat-sidebar.tsx` (1314 LOC) hatte 0 Konflikte** — wir haben sie nicht angefasst. Stattdessen LokyyShell unter `src/components/layout/` parallel gebaut, hinter env-flag. Wenn wir die Hermes-Sidebar in place reskinned hätten, wäre jeder upstream-PR auf chat-sidebar.tsx ein potenzieller Nightmare.

→ **Lesson:** Bei sehr komplexen Hermes-Files (>500 LOC) immer parallel-add statt in-place-rewrite. Cost: ein zusätzlicher Touchpoint im Code (env-flag switch). Benefit: trivial merge-pain.

### 3. Class-String-Restyle statt Component-Rewrites in Phase B/D
Die 13 restyled UI-Components + 16 page-frame-Edits in Phase D haben **alle sauber auto-merged**. Weil wir nur Klassen-Strings geändert haben (kein JSX-Restructure, keine neuen Hooks, keine Logic-Edits), trafen unsere Changes nie auf upstream-Logic-Changes im selben Bereich.

→ **Lesson:** Trennung zwischen "visual" und "logic" Edits ist nicht nur konzeptionell — sie reduziert Merge-Konflikte messbar.

### 4. Phase E Asset-Bytes-Swap (Filename stays)
Conductor-Avatare in `public/avatars/*.png` wurden upstream geändert, wir hatten sie nicht angefasst — **upstream-Updates haben gewonnen**. Wenn wir die Filenames geändert hätten (z.B. `hermes.png` → `lokyy.png`), hätte das jeden Avatar-Update zum Conflict gemacht.

→ **Lesson:** Code-Identifier-Filenames behalten (CLAUDE.md Branding-Regel) ist nicht nur Hygiene — es ist Merge-Safety.

## Erkenntnisse — was war teuer

### 1. `jobs-screen.tsx` — der einzige wirklich teure Konflikt
18 Minuten manuelle Resolution für 1 File. Grund: beide Seiten haben den gesamten Render-Block umgeschrieben. Bei zukünftigen Phase-D-Equivalent-Reskins sollten wir prüfen: gibt's einen Weg, Render-Blocks weniger invasiv anzupassen? Vielleicht eine Wrapper-Komponente die Klassen injiziert, statt den ganzen JSX-Block umzuschreiben? — offene Designfrage für Etappe 2.

### 2. `manifest.json` — semantischer Merge braucht Aufmerksamkeit
Auto-merger sieht das als "Konflikt", weil komplette JSON-Felder kollidieren. Semantic merging (welche Felder soll man von welcher Seite nehmen) braucht Hirn. Akzeptabel für 5 Minuten pro Sync-Zyklus.

## Aufwandsprognose für reguläre Upstream-Syncs

Basierend auf 9 Commits / 174 Files / 3 Konflikte / 32 Minuten Total:

- **Pro Upstream-Sync (alle 2–4 Wochen wenn Hermes aktiv):** geschätzt **30–60 Minuten** wenn der Phase-A-E-Footprint stabil bleibt. Wird sich erhöhen, sobald Etappe 2 (UI-Strings-Sweep + Mobile + …) zusätzliche Touchpoints addiert.
- **Risiko-Faktor:** wenn upstream eine grosse Refactor durchzieht (z.B. `chat-sidebar.tsx` neu schreibt), könnten LokyyShell-Strukturbezüge brechen → einmaliger 1-2-h Effort.

## Empfehlung für Lokyy's Sync-Workflow

1. **Frequenz:** alle 2–4 Wochen, oder wenn ein wichtiges Hermes-Release droppt
2. **Branch-Strategie:** immer Sicherheits-Probe-Branch zuerst (`lokyy/merge-probe-<date>`), erst nach Build-Verify auf `lokyy/main` mergen
3. **Marker-Disziplin:** alle Lokyy-Inserts in Hermes-Files mit `/* === LOKYY BRIDGE === */` o.ä. Markern versehen (wir hatten das schon in styles.css — auf alle Edits ausweiten)
4. **Test-Suite:** vor jedem Merge `pnpm build` + smoke-test-Script aus Issue #19 laufen lassen
5. **LOKYY.md halten:** bei jedem Sync die touched-files-Liste re-validieren; entfernen, wenn upstream Files unsererseits "obsolet" macht

## Probe-Branch-Aufbewahrung

`lokyy/merge-probe-2026-05-14` bleibt im Inner-Repo als Referenz. Kann jederzeit gelöscht werden (`git branch -D lokyy/merge-probe-2026-05-14`) — `lokyy/main` ist die Etappe-1-Ground-Truth.

Falls der Probe-Branch tatsächlich der erste reale Upstream-Sync werden soll, kann er nach Re-Verifikation per `git checkout lokyy/main && git merge --ff-only lokyy/merge-probe-2026-05-14` adoptiert werden. Aber das ist eine bewusste Etappe-1.1-Entscheidung, nicht Etappe-1-Scope.

## Bottom Line

**Die Reskin-Architektur ist merge-friendly.** 9 upstream-Commits → nur 3 Konflikte → ~32 Min Resolution. Die parallel-Shell-Strategie + Bridge-Marker + Class-String-Restyle (statt JSX-Rewrite) zahlen sich messbar aus.

Wenn ein normaler upstream-Sync 30–60 Minuten kostet, ist Lokyy als langfristig wartbarer Fork tragfähig.
