# Recon Findings — UI-Komponenten (Issue #6, Step 2.3)

**Pfad:** `lokyy-workspace/src/components/ui/`
**Recon-Datum:** 2026-05-14
**Analyst:** Mary (BMAD Business Analyst)
**Modus:** READ-ONLY — keine Datei verändert.

---

## 2.3 UI-Komponenten-Inventar

### Vollständige Komponenten-Tabelle

Alle 16 `*.tsx` Dateien in `lokyy-workspace/src/components/ui/`:

| # | Datei | base-ui Import? | Styling-Methode | Zweck (1 Zeile) |
|---|---|---|---|---|
| 1 | `alert-dialog.tsx` | ✅ `@base-ui/react/alert-dialog` (L3) | Tailwind via `cn()` + inline `style={{ width }}` für Sizing | Bestätigungsdialog mit Kompositions-Wrapper über Base UI |
| 2 | `autocomplete.tsx` | ✅ `@base-ui/react/autocomplete` (L3) | Tailwind via `cn()` + inline `style` (Positioner-Offsets) | Such-/Autocomplete-Komponente (Basis für `command.tsx`) |
| 3 | `braille-spinner.tsx` | ❌ pure React | Tailwind via `cn()` + custom Unicode-Logik | Animierter Braille-Spinner (8-Dot-Pattern) |
| 4 | `button.tsx` | ✅ `@base-ui/react/merge-props` + `use-render` (L3-4) | **`cva()`** (class-variance-authority) + Tailwind | Primärer Button mit Variants (default/destructive/outline/ghost/link) und Sizes |
| 5 | `collapsible.tsx` | ✅ `@base-ui/react/collapsible` (L3) | Tailwind via `cn()`, custom CSS-Variablen `--theme-*` | Aufklappbarer Bereich (Sidebar-Sections) |
| 6 | `command.tsx` | ✅ `@base-ui/react/dialog` (L3) — nutzt intern Autocomplete | Tailwind via `cn()` | Command-Palette / Cmd-K Dialog |
| 7 | `dialog.tsx` | ✅ `@base-ui/react/dialog` (L3) | Tailwind via `cn()` + inline `style` prop pass-through | Modaler Dialog-Wrapper (Standard) |
| 8 | `input.tsx` | ✅ `@base-ui/react/input` (L3) | Tailwind via `cn()`, size-Prop steuert Klassen | Text-Input mit `sm`/`default`/`lg`/numerischer Size |
| 9 | `menu.tsx` | ✅ `@base-ui/react/menu` (L3) | Tailwind via `cn()` + inline `style` (Positioner) | Dropdown-Menü (ersetzt Shadcn `dropdown-menu`) |
| 10 | `preview-card.tsx` | ✅ `@base-ui/react/preview-card` (L3) | Tailwind via `cn()` + inline `style` (Positioner) | Hover-Card / Vorschau-Popup |
| 11 | `scroll-area.tsx` | ✅ `@base-ui/react/scroll-area` (L3) | Tailwind via `cn()` | Custom Scrollbar-Wrapper |
| 12 | `switch.tsx` | ✅ `@base-ui/react/switch` (L3) | Tailwind via `cn()`, CSS-Var `--thumb-size`, `data-checked`/`data-unchecked` Selektoren | Toggle-Switch mit expliziten ON/OFF-Labels (Issue #284 fix) |
| 13 | `tabs.tsx` | ✅ `@base-ui/react/tabs` (L3) | Tailwind via `cn()`, Variant-Param (`default`/`underline`) | Tab-Navigation |
| 14 | `three-dots-spinner.tsx` | ❌ pure React | Tailwind via `cn()` + **globale CSS-Klasse** `.three-dots-spinner` | Drei-Punkt-Lade-Animation |
| 15 | `toast.tsx` | ❌ pure React | Tailwind via `cn()` + `createPortal`, Listener-Pattern | Eigenes leichtgewichtiges Toast-System (KEIN Sonner/Radix) |
| 16 | `tooltip.tsx` | ✅ `@base-ui/react/tooltip` (L3) | Tailwind via `cn()` + inline `style` (Positioner) | Tooltip mit `delay=0` Provider |

**Statistik:**
- 13/16 (81 %) verwenden `@base-ui/react`
- 1 Komponente (`button.tsx`) nutzt **`cva()`** für Variants — der Shadcn-Standard-Ansatz
- 7 Komponenten benutzen inline `style={{…}}` — alle für Base UI Positioner/Sizing-Props, nicht für reine Optik
- `cn()` aus `@/lib/utils` ist universell (alle 16 Dateien)
- 3 Komponenten sind pure React ohne Base UI: `braille-spinner`, `three-dots-spinner`, `toast`

### Sanity-Check: `dialog.tsx` Base-UI-Import

```ts
// lokyy-workspace/src/components/ui/dialog.tsx:3
import { Dialog } from '@base-ui/react/dialog'
```

✅ Bestätigt: Komponenten importieren tatsächlich aus `@base-ui/react` (nicht aus Radix).

---

## Shadcn-Gap-Analyse

Vergleich gegen den Shadcn-Canonical-Komponenten-Katalog. Für die Lokyy-Etappe-1-Reskin (Shadcn-Dashboard-Look) relevant.

| Shadcn-Komponente | Im Workspace? | Anmerkung / Geplante Phase-B-Addition? |
|---|---|---|
| `button` | ✅ vorhanden | `button.tsx` mit `cva()` — Shadcn-konform |
| `input` | ✅ vorhanden | `input.tsx` über Base UI |
| `dialog` | ✅ vorhanden | `dialog.tsx` über Base UI |
| `alert-dialog` | ✅ vorhanden | `alert-dialog.tsx` über Base UI |
| `switch` | ✅ vorhanden | `switch.tsx` über Base UI |
| `tabs` | ✅ vorhanden | `tabs.tsx` über Base UI |
| `scroll-area` | ✅ vorhanden | `scroll-area.tsx` über Base UI |
| `collapsible` | ✅ vorhanden | `collapsible.tsx` über Base UI |
| `tooltip` | ✅ vorhanden | `tooltip.tsx` über Base UI |
| `dropdown-menu` | ✅ vorhanden als `menu.tsx` | Base-UI-Naming (`menu`) — funktional äquivalent zu Shadcn `dropdown-menu` |
| `popover` / `hover-card` | ✅ vorhanden als `preview-card.tsx` | Base-UI-Naming — deckt Hover-Card/Popover-Use-Case ab |
| `command` | ✅ vorhanden | `command.tsx` (Base UI Dialog + Autocomplete) — kein cmdk |
| `toast` / `sonner` | ✅ vorhanden | `toast.tsx` — Eigenbau, kein externes Lib |
| **`card`** | ❌ **FEHLT** | **Phase B Kandidat** — zentrale Shadcn-Dashboard-Primitive |
| **`badge`** | ❌ **FEHLT** | **Phase B Kandidat** — Status/Label-Indikatoren |
| **`separator`** | ❌ **FEHLT** | **Phase B Kandidat** — trivial; oft `<hr>` oder Border-Util heute |
| **`sheet`** | ❌ **FEHLT** | Phase B Kandidat — Side-Panel/Drawer (`@base-ui/react` hat keinen direkten Sheet, evtl. Dialog-Variant) |
| **`table`** | ❌ **FEHLT** | **Phase B Kandidat** — Dashboard braucht Tabellen |
| **`skeleton`** | ❌ **FEHLT** | **Phase B Kandidat** — Loading-States |
| **`label`** | ❌ **FEHLT** | **Phase B Kandidat** — Form-Labels (aktuell vermutlich roher `<label>`) |
| **`alert`** | ❌ FEHLT | Phase B Kandidat — Inline-Hinweis (Toast deckt nur transient) |
| `accordion` | ❌ FEHLT | Funktional über `collapsible.tsx` abgedeckt — kein dringender Bedarf |
| `avatar` | ❌ FEHLT | Optional Phase B — falls UI Avatare zeigt |
| `breadcrumb` | ❌ FEHLT | Optional — wenn Routing-UI das braucht |
| `calendar` / `date-picker` | ❌ FEHLT | Vermutlich nicht benötigt für Lokyy |
| `checkbox` | ❌ FEHLT | Base UI hat `@base-ui/react/checkbox` — leicht ergänzbar |
| `radio-group` | ❌ FEHLT | Base UI hat `@base-ui/react/radio` — leicht ergänzbar |
| `select` | ❌ FEHLT | Base UI hat `@base-ui/react/select` — leicht ergänzbar |
| `slider` | ❌ FEHLT | Base UI hat `@base-ui/react/slider` — leicht ergänzbar |
| `textarea` | ❌ FEHLT | Trivial — meist nativer `<textarea>` mit `cn()` |
| `pagination` | ❌ FEHLT | Falls Tabellen kommen, wahrscheinlich nötig |
| `form` | ❌ FEHLT | Shadcn-Form ist react-hook-form-Wrapper — vermutlich nicht relevant |

### Empfehlung Phase-B-Additionen (Priorität für Shadcn-Dashboard-Look)

**Must-have (P1):** `card`, `badge`, `separator`, `table`, `skeleton`, `label`
**Should-have (P2):** `sheet`, `alert`
**Nice-to-have (P3):** `avatar`, `checkbox`, `select`, `textarea`

Alle P1/P2-Komponenten sind in Shadcn-Standard-Form rein präsentationell und benötigen keine Base-UI-Primitive (außer `sheet`, der einen Dialog-Cousin braucht). Sie können in Phase B ohne neue Library hinzugefügt werden.

---

## Auffälligkeiten

1. **Base UI ≠ Radix.** Alle interaktiven Primitives kommen aus `@base-ui/react/*` (von Mui-Maintainern), nicht Radix. Shadcn-CLI-Komponenten direkt zu kopieren funktioniert **nicht** — sie nutzen Radix. Bei jeder Addition muss das Radix-Primitive durch das passende Base-UI-Pendant ersetzt werden (z.B. `@radix-ui/react-dialog` → `@base-ui/react/dialog`).

2. **`button.tsx` ist der einzige `cva()`-Konsument.** Alle anderen Variant-Logiken laufen über bedingte Strings in `cn()` (siehe `tabs.tsx` Variant `default`/`underline`, `input.tsx` Size-Prop). Bei Phase-B-Additionen sollte entschieden werden, ob `cva()` Standard wird oder nicht — Konsistenz fehlt aktuell.

3. **Inline `style={{...}}` ist Base-UI-Eigenheit, kein Anti-Pattern.** 7/16 Komponenten setzen inline-`style` — fast immer für Base-UI-`Positioner`-Sizing (`width`, `align-offset`, etc.), das sich nicht sauber über Tailwind ausdrücken lässt. Beim Reskin nicht "wegrationalisieren".

4. **CSS-Variablen-Konvention `--theme-*`.** `collapsible.tsx` (L18) verwendet `var(--theme-muted)`, `var(--theme-card2)`, `var(--theme-text)`. Das deutet auf ein Theme-Variablen-Layer hin (vermutlich in `index.css` / globale CSS, gehört zu Recon-Issue #5 — Theme-System). Bei Token-Migration: `--theme-*` ist der bestehende Vertrag.

5. **`autocomplete.tsx` ist die größte UI-Komponente** (10.235 Bytes, ~250 LOC) — komposit aus `Autocomplete.Root/Input/List/Group/Item/...` Subkomponenten. `command.tsx` baut darauf auf. Bei Reskin: zentrale Stelle, viele Stellen mit Klassen.

6. **`toast.tsx` ist Eigenbau** — kein Sonner, kein Radix-Toast. Singleton-Listener-Pattern mit `createPortal`. Behalten wie er ist; Visuals (Tailwind-Klassen) lassen sich im Reskin trotzdem ändern.

7. **Drei Spinner-Varianten** (`braille-spinner`, `three-dots-spinner`, plus impliziter Loader im `button.tsx`?). Falls Lokyy einen einheitlichen Loading-Stil will, ist das ein Diskussionspunkt — aber nicht Etappe-1-Scope.

8. **Keine echten Forms.** Kein `form.tsx`, kein `label.tsx`, kein `checkbox.tsx`, kein `select.tsx`. Lokyy-Pages mit Form-Eingaben werden derzeit vermutlich mit rohen HTML-Elementen + `cn()` gebaut. Für Phase-B-Reskin: gut zu wissen — wir reskinnen Tabellen/Cards, keine Form-Library.

---

## Anchor-Zitate für nachgelagerte Issues

- Base UI Import-Pattern: `lokyy-workspace/src/components/ui/dialog.tsx:3`, `…/alert-dialog.tsx:3`, `…/tooltip.tsx:3`
- `cva()`-Beispiel: `lokyy-workspace/src/components/ui/button.tsx:5`
- Theme-CSS-Variablen-Nutzung: `lokyy-workspace/src/components/ui/collapsible.tsx:18`
- Eigenbau-Toast: `lokyy-workspace/src/components/ui/toast.tsx:1-30`

---

*Recon abgeschlossen. Keine Datei in `lokyy-workspace/` verändert. Issue #6 bleibt OPEN — Orchestrator schließt am Ende von Etappe-1.*
