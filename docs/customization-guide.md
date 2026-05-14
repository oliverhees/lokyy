# Lokyy Customization Guide

> **Audience:** Anyone (Oliver, future contributors, future-self) who wants to add pages, change pages, replace pages, or hide pages in Lokyy — without breaking upstream merges with Hermes Workspace.
>
> **Source-of-truth data:** Real numbers from Issue [#20 — Upstream-Merge-Probe](https://github.com/oliverhees/lokyy/issues/20). 9 upstream commits, 174 touched files, 3 conflicts, 32 minutes total resolution. Patterns below are validated against that probe.

---

## TL;DR

Yes, you can do all of it. The cost at the next `git fetch upstream && git merge upstream/main` depends on which **pattern** you use.

| Was du machst | Merge-Cost (per upstream sync) | Pattern |
|---|---|---|
| **Neue Seite hinzufügen** | **0 min** | Pure-Add (Section A) |
| **Bestehende Seite umstylen** | ~5 min | Class-String-Restyle (Section B) |
| **Bestehende Seite teilweise umbauen** | ~10–30 min | Parallel + Env-Flag (Section C) |
| **Hermes-Seite komplett ersetzen** | smart: ~5 min · naiv: 30–60+ min | Redirect-Pattern (Section D) |
| **Hermes-Feature ausblenden** | ~2 min | Sidebar-Omission (Section E) |
| **Code-Identifier umbenennen** | **🚫 don't** | Anti-Pattern (Section H) |

---

## A — Neue Seite hinzufügen (Pure-Add · Cost: 0)

Wenn du eine ganz neue Lokyy-Seite willst die Hermes nicht hat (`/lokyy-blog`, `/onboarding-tour`, `/lokyy-pricing`, eigenes Dashboard-Widget):

### Schritte

1. Route file: `lokyy-workspace/src/routes/lokyy-blog.tsx`
2. Screen folder: `lokyy-workspace/src/screens/lokyy-blog/blog-screen.tsx`
3. Sidebar-Eintrag in `src/components/layout/app-sidebar.tsx` ergänzen
4. Den Phase-B-Komponenten-Set nutzen (`<Card>`, `<Button>`, `<Badge>`, `<Sheet>`)

### Warum 0 Konflikte
Hermes upstream kennt die Lokyy-Routes nicht. Sie sind reine Adds in Folders die du frei nutzen kannst. Auto-Merger sieht sie nie.

### Caveat
`src/routeTree.gen.ts` regeneriert sich beim `pnpm dev` von alleine — dabei wird auch deine neue Route eingetragen. Diesen File **nicht manuell editieren** (Brief-OFF-LIMITS).

---

## B — Bestehende Hermes-Seite umstylen (Class-Restyle · Cost: ~5 min)

Beispiele aus unserer Phase D: dashboard-screen.tsx, operations-screen.tsx, jobs-screen.tsx — 16 Hermes-Files visuell rebrandet, **alle auto-merged** in der #20-Probe (mit 1 Ausnahme jobs-screen.tsx wegen JSX-Restructure, dazu siehe Section H).

### Schritte

1. Open the Hermes-File (z.B. `src/screens/dashboard/dashboard-screen.tsx`)
2. **Nur Tailwind-Klassen** ersetzen: `bg-[var(--theme-bg)]` → `bg-background`, `bg-primary-50` → bleibt (greift via Aliasing), Hermes-spezifische Klassen → Lokyy-Tokens
3. JSX-Struktur unverändert lassen
4. Wenn du `<Card>` willst — als Wrapper drüber (zusätzliches `<div>`), nicht JSX-Restructure
5. Eintrag in `LOKYY.md` ergänzen

### Konflikt-Math

`git merge` sieht: "lokyy hat Zeile 15 von `<div className="bg-surface">` auf `<div className="bg-background">` geändert. Upstream hat in derselben Datei Zeile 200 geändert (ein useState dazu). Zeile 15 ≠ Zeile 200 → auto-merge OK."

So lange ihr beide nicht im selben Block schreibt, mergen Class-String-Edits sauber.

---

## C — Bestehende Seite teilweise umbauen (Parallel + Flag · Cost: 10–30 min)

Wenn die Hermes-Page so umgekrempelt wird dass Class-Tausch nicht reicht — wie das `LokyyShell` vs `Hermes-Shell`-Pattern aus Phase C.

### Schritte

1. **Neuer Folder/File** `src/components/layout/lokyy-shell.tsx` mit deiner kompletten neuen Implementation
2. **Mini-Patch** im Original-Entry-Point (z.B. `workspace-shell.tsx`):

```tsx
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  if (import.meta.env.VITE_LOKYY_LAYOUT === '1') {
    return <LokyyShell>{children}</LokyyShell>
  }
  // ... original Hermes shell unchanged below
}
```

3. Env-Flag-Default = OFF. Hermes-Verhalten ist bitweise identisch wenn der Flag nicht gesetzt ist.
4. Du toggelst lokal via `.env` Datei (gitignored)

### Konflikt-Math

`chat-sidebar.tsx` (1314 LOC) blieb in #20 bitweise unangetastet — also 0 Konflikte selbst wenn upstream daran arbeitet. Der einzige Touchpoint ist die +5-Zeilen-Patch in `workspace-shell.tsx`, und der sitzt am Methoden-Anfang (weit weg von typischen upstream-Edits).

### Real-Beispiel

`src/components/layout/{lokyy-shell,app-sidebar,app-header}.tsx` — 350 Lokyy-Lines parallel zur 1700-LOC Hermes-Shell, 0 Konflikte in der #20-Probe.

---

## D — Hermes-Seite komplett ersetzen (Redirect-Pattern · Cost: ~5 min smart)

Wenn du Hermes' Login durch ein eigenes Lokyy-Login ersetzen willst, oder den Onboarding-Flow durch deinen.

### Smart: Redirect

```tsx
// src/routes/hermes-onboarding.tsx (original Hermes-Route, bleibt im Repo)
import { redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/hermes-onboarding')({
  beforeLoad: () => {
    if (import.meta.env.VITE_LOKYY_LAYOUT === '1') {
      throw redirect({ to: '/lokyy-onboarding' })
    }
  },
  component: HermesOnboarding, // existing component untouched
})
```

Plus deine eigene Lokyy-Route `/lokyy-onboarding` als Pure-Add (Section A).

### Konflikt-Math
- Original-Hermes-File: nur `beforeLoad` ergänzt — minimaler Touchpoint
- Lokyy-Route: Pure-Add, kein Konflikt-Risiko

### Naiv: Hermes-File rewrite
```
git mv hermes-onboarding.tsx hermes-onboarding.tsx.legacy  ← Datei tauschen
```
Jeder upstream-PR auf `hermes-onboarding.tsx` ist jetzt ein File-Level-Konflikt + du musst manuell entscheiden welche Änderung in deine neue Version übernommen wird. **Vermeiden.**

---

## E — Hermes-Feature ausblenden (Sidebar-Omission · Cost: ~2 min)

Was wir mit den Hermes-Marketing-Routes (`/world`, `/playground`, `/agora`, etc.) gemacht haben. Code bleibt im Repo (kein Konflikt), ist aber via Lokyy-UI nicht erreichbar.

### Schritte

1. In `src/components/layout/app-sidebar.tsx` den Nav-Item für die Route **nicht** auflisten
2. Optional: redirect von der Hermes-Route auf `/dashboard` wenn jemand direct die URL nutzt
3. Eintrag in `LOKYY.md` unter "Nicht in Lokyy-Sidebar"

### Caveat

Wenn die Hermes-Page Assets referenziert die du in Phase E gelöscht hast (siehe Q-004 in `docs/questions.md`): direkte URL-Aufrufe geben 404 für Images. Akzeptiert für hidden routes.

---

## F — Token-System erweitern (Bridge-Marker · Cost: 0)

Wenn du neue Lokyy-spezifische CSS-Variablen brauchst (z.B. Brand-Gradient, Lokyy-spezifischer Shadow):

### Schritte

1. In `src/styles.css` innerhalb der existierenden `/* === LOKYY BRIDGE === */` Markers ergänzen
2. Plus im `@theme inline`-Block falls Tailwind-Utility-Klassen daraus werden sollen

### Konflikt-Math

`styles.css` hatte in #20 0 Konflikte trotz 280 inserted lines, weil die LOKYY BRIDGE-Markers das Auto-Merger-Tool eindeutige Hooks geben. Beibehalten.

---

## G — Komponente "borgen" (Phase-B-Pattern)

Wenn du eine Hermes-Komponente nur visuell brauchst aber strukturell verändern willst:

1. **Hermes-Komponente nicht touchen.** Stattdessen: Phase-B `<Card>`, `<Badge>`, `<Button>`, `<Sheet>` etc. aus `src/components/ui/` zusammenbauen
2. Wenn dir eine fehlt: nach gleichem Pattern wie Phase-B-Components anlegen (Base UI + cva)
3. Verwende diese in deinen Lokyy-Screens (Pure-Add)

---

## H — Anti-Patterns (NICHT tun)

### H1: JSX-Refactor existierender Hermes-Komponente

Beispiel: `jobs-screen.tsx` aus #20. Wir hatten den Header-Block + Suchleiste umstrukturiert. Resolution-Aufwand bei nächstem upstream-Merge: 18 min — und das obwohl wir die Klassen UND die Strukturen passend gehalten haben.

**Lesson:** wenn ein Hermes-File >300 LOC ist UND aktiv upstream entwickelt wird, **nicht in-place refactoren**. Parallel-Pattern (Section C) nutzen.

### H2: File rename / move

`mv hermes-foo.tsx lokyy-foo.tsx` brennt im nächsten upstream-PR auf der Datei. Auch route-renames (`/hermes-world` → `/lokyy-world`) crashen weil Hermes upstream weiter `/hermes-world` updated und deine Edits auf der neuen URL hängen.

**Stattdessen:** Redirect-Pattern (Section D).

### H3: Code-Identifier umbenennen

CLAUDE.md Brand-Regel sagt explizit:
- `"name": "hermes-workspace"` in `package.json` bleibt
- Theme-IDs `claude-nous`, `claude-classic` etc. bleiben
- Komponenten-Klassen-Namen bleiben
- Conductor-Avatar-Filenames (`hermes.png`) bleiben

Warum? Diese Identifier referenzieren sich gegenseitig im Code. Wenn du sie umbenennst, kollidiert das mit JEDEM upstream-PR der diesen Identifier irgendwo touched. Und unser Phase-E hat schon bewiesen dass Filename-Stays + Byte-Replace die saubere Lösung ist.

---

## I — Frühwarnsystem: LOKYY.md

`LOKYY.md` im Repo-Root trackt jeden Hermes-File den Lokyy touched.

**Brief-Schwelle:** 8–10 Touched-Categories. Etappe 1 endet mit ~10 — wir sind am oberen Rand.

### Wenn du eine neue Touched-Datei einträgst:

```markdown
| `src/screens/foo/foo-screen.tsx` | Lokyy-Anpassung: <was geändert>, <warum>, <Pattern aus diesem Guide> | Etappe 2 / [#42](...) |
```

### Wenn die Schwelle reißt (>10):

**STOP und nachdenken.** Vermutlich gibt es eine geplante Änderung die besser als Parallel-Komponente (Section C) statt In-Place gemacht werden sollte. Architecture-Review schreiben, ADR ergänzen, dann erst weiter.

---

## J — Workflow für jede Etappe 2+

```
Etappe-2-Issue öffnet
   │
   ▼
Welcher Pattern aus A–G passt?  →  A: Pure-Add (best!)
                                    B: Class-Restyle
                                    C: Parallel + Flag
                                    D: Redirect
                                    E: Sidebar-Omission
                                    F: Bridge-Marker
                                    G: Phase-B-Compose
                                    H: AVOID
   │
   ▼
LOKYY.md-Schwellen-Check  →  Sind wir <10 Touched-Categories?
                              Ja → Implementation
                              Nein → ADR + Architecture-Rethink
   │
   ▼
BMAD-Agent (Amelia für Code, Sally für Design, Mary für Recon)
   │
   ▼
Inner-Commit mit `(refs #<issue>)` Suffix
   │
   ▼
Outer-Commit mit `Closes #<issue>` + Verification-Shot
   │
   ▼
Nach jedem 3-5 Etappe-2-Issues: Mini-Merge-Probe gegen aktuelles upstream/main
   │
   ▼
Falls Mini-Probe >30 min Aufwand:  →  Architecture-Review starten
                                       Vielleicht Parallel-Component für die teure Stelle
```

---

## Real-Numbers aus Etappe 1

| Phase | Touched-Files (Hermes-Code) | Merge-Cost (in #20 simuliert) |
|---|---|---|
| A — Token-Layer | 3 | 0 Konflikte |
| A++ — Hermes-Aliasing | 1 (`styles.css`) | 0 (Marker-Pattern) |
| B — UI-Restyle | 13 + 1 (`styles.css`) | 0 (Class-Restyle) |
| B — New Components | 8 neue Files | 0 (Pure-Add) |
| C — LokyyShell | 3 neue + 2 Mini-Patches | 0 (Parallel + Flag) |
| D — Page-Frame | 16 | 1 Konflikt (jobs-screen — Lesson) |
| E — Docs/Assets | 5 + 14 Asset-Bytes | 1 Konflikt (manifest semantischer Merge) |
| Total | **10 categories**, ~50 individual files | **3 Konflikte, 32 min Resolution** |

### Bedeutet für Etappe 2:

Wenn du noch mal 10 Etappe-2-Issues nach den oben dokumentierten Patterns machst, sollte der Aufwand bei vierteljährlich-Upstream-Sync bei **30–90 min** liegen. Wenn er deutlich höher wird → **du hast Anti-Patterns (H) verwendet** und solltest reverten.

---

## Cross-References

- [`LOKYY-ETAPPE-1-RESKIN.md`](../LOKYY-ETAPPE-1-RESKIN.md) — Original-Brief
- [`LOKYY.md`](../LOKYY.md) — Touched-Files-Tracker
- [`docs/decisions/ADR-001-lokyy-workspace-integration.md`](decisions/ADR-001-lokyy-workspace-integration.md) — Outer/Inner-Repo-Strategie
- [`docs/upstream-merge-probe.md`](upstream-merge-probe.md) — Die Messung aus Issue #20 von der die Numbers oben kommen
- [`docs/setup-hermes-gateway.md`](setup-hermes-gateway.md) — Gateway-Setup falls "Offline"-Stati zurückkommen
- [`docs/swarm-redesign-proposal.md`](swarm-redesign-proposal.md) — Beispiel für ein Pattern-C (Parallel + Flag)-Pre-Design

---

## TL;DR redux

**Bauen ist günstig. Stylen ist günstig. Umbauen geht mit Flags. Ersetzen geht mit Redirects. Don't refactor, don't rename, don't rebrand identifiers.**

Wenn du dich daran hältst, bleibt Lokyy ein langfristig wartbarer Fork.
