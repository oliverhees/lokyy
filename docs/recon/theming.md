# Recon-Findings: Theming-System

Sammelfile für die Theming-Recon. Issue #5 (KRITISCH) — Eingabe für die Token-Layer-Bridge-Strategie in Phase A.

---

## 2.2 Theming-System (KRITISCH)

### Globales CSS

| Pfad | Zeilen | Rolle |
|---|---:|---|
| `lokyy-workspace/src/styles.css` | 1533 | Haupt-Theme-Stylesheet — Tailwind-Import, globale Utilities, alle `[data-theme=…]`-Blöcke |
| `lokyy-workspace/src/scifi-theme.css` | 394 | Zusatz-Stylesheet, am Ende von `styles.css` importiert (`styles.css:1533`) |

Top des Hauptfiles (`styles.css:1-12`):

```css
@import url('https://fonts.googleapis.com/...');  /* Inter, EB Garamond, JetBrains Mono */
@import 'tailwindcss';                              /* Tailwind v4 */
@variant dark (&:where(.dark, .dark *));            /* aktiviert dark:-Variante an .dark-Klasse */

:root {
  --tabbar-h: 0px;
  --chat-content-max-width: 900px;
}
```

### Theming-Mechanismus (HOW)

Klassischer **CSS-Custom-Properties-Switch über `[data-theme='…']`-Attribut** auf `<html>`. Vor First Paint wird das Theme via Inline-Bootstrap-Script aus `localStorage` gelesen und gesetzt; danach malen Komponenten mit `var(--theme-*)` ohne weiteres JS.

Switching-Skelett (`styles.css:714-1135`):

```css
[data-theme='claude-nous']   { --theme-bg: #041c1c; --theme-accent: #ffac02; … }
[data-theme='claude-official']{ --theme-bg: #0a0e1a; --theme-accent: #6366f1; … }
[data-theme='claude-classic'] { --theme-bg: #0d0f12; --theme-accent: #b98a44; … }
[data-theme='claude-slate']   { --theme-bg: #0d1117; --theme-accent: #7eb8f6; … }
```

Komponenten konsumieren ausschließlich Tokens (`styles.css:60-149`):

```css
.theme-bg     { background-color: var(--theme-bg) !important; }
.theme-card   { background-color: var(--theme-card) !important; }
.theme-border { border-color: var(--theme-border) !important; }
.theme-accent { color: var(--theme-accent) !important; }
```

Parallel hält das Bootstrap-Skript eine `.dark` / `.light`-Klasse auf `<html>` synchron, damit Tailwind-`dark:`-Utilities (`@variant dark` in `styles.css:5`) im selben Frame greifen.

### Theme-Variablen (Inventar)

Komplette Liste der `--theme-*`-Tokens, die jedes Theme deklariert (Werte exemplarisch aus `claude-nous` / `claude-nous-light`, `styles.css:1091-1181`):

| Token | Rolle | `claude-nous` (dark) | `claude-nous-light` (light) |
|---|---|---|---|
| `--theme-bg` | App-Background | `#041c1c` | `#f8faf8` |
| `--theme-sidebar` | Sidebar-Surface | `#06282a` | `#f2f6f4` |
| `--theme-panel` | Panel-Surface (Mid-Layer) | `#06282a` | `#f4f7f5` |
| `--theme-card` | Card-Surface | `#082f31` | `#fbfdfb` |
| `--theme-card2` | Card-Surface (Variante) | `#0a3638` | `#f1f5f2` |
| `--theme-border` | Standard-Border | `rgba(255,230,203,0.2)` | `rgba(30,74,92,0.18)` |
| `--theme-border-subtle` | Subtiler Border | `rgba(255,230,203,0.1)` | `rgba(30,74,92,0.1)` |
| `--theme-text` | Foreground | `#ffe6cb` | `#16315f` |
| `--theme-muted` | Muted-Text | `rgba(255,230,203,0.6)` | `rgba(22,49,95,0.6)` |
| `--theme-shadow-1` | Shadow (sm) | `0 1px 2px rgba(0,0,0,0.55)` | `0 0 0 rgba(22,49,95,0)` |
| `--theme-shadow-2` | Shadow (md) | `0 6px 16px rgba(0,0,0,0.48)` | `0 1px 2px rgba(22,49,95,0.03)` |
| `--theme-shadow-3` | Shadow (lg) | `0 16px 36px rgba(0,0,0,0.58)` | `0 8px 24px rgba(22,49,95,0.05)` |
| `--theme-glass` | Glas-Overlay | `rgba(4,28,28,0.88)` | `rgba(248,250,248,0.92)` |
| `--theme-focus` | Focus-Ring | `#ffac02` | `#2557b7` |
| `--theme-accent` | Primary-Accent | `#ffac02` | `#2557b7` |
| `--theme-accent-secondary` | Accent (variant) | `#ffe6cb` | `#3f6fca` |
| `--theme-accent-subtle` | Accent-Tint (bg) | `rgba(255,172,2,0.12)` | `rgba(37,87,183,0.07)` |
| `--theme-accent-border` | Accent-Border | `rgba(255,172,2,0.28)` | `rgba(37,87,183,0.18)` |
| `--theme-active` | Active-State | `#ffac02` | `#2557b7` |
| `--theme-link` | Link-Color | `#ffe6cb` | `#2557b7` |
| `--theme-success` | Success | `#8fff89` | `#4f7c64` |
| `--theme-warning` | Warning | `#ffac02` | `#9c6b2f` |
| `--theme-danger` | Danger | `#fb2c36` | `#a24b4b` |
| `--theme-stripe` | Stripe / Zebra | `rgba(255,230,203,0.05)` | `rgba(30,74,92,0.05)` |
| `--theme-header-bg` | Header-Surface | `#041c1c` | `#f2f6f4` |
| `--theme-header-border` | Header-Border | `rgba(255,230,203,0.2)` | `rgba(30,74,92,0.16)` |
| `--theme-input` | Input-Surface | `#06282a` | `#fbfdfb` |

Zusätzliche **Chat-/Composer-/Tool-/Code-Tokens** (kein `--theme-`-Präfix, aber Teil jedes Theme-Blocks — `styles.css:1118-1134`):

`--chat-user-bg/border/foreground`, `--chat-assistant-bg/border/foreground`, `--composer-bg/border/placeholder`, `--tool-card-bg/border/title/muted`, `--code-bg/border/foreground`.

### Themes

Whitelist im Bootstrap (`__root.tsx:51-60`) — exakt **8 erlaubte Themes** (4 Familien × dark/light):

| Theme | Datei:Zeile | Charakteristisch (Accent / Bg) | Anmerkung |
|---|---|---|---|
| `claude-nous` (DEFAULT) | `styles.css:1091` | Amber `#ffac02` auf Teal-Black `#041c1c` | Default in `__root.tsx:50` |
| `claude-nous-light` | `styles.css:1137` | Royal-Blau `#2557b7` auf Off-White `#f8faf8` | |
| `claude-official` | `styles.css:804` | Indigo `#6366f1` auf Deep-Navy `#0a0e1a` | |
| `claude-official-light` | `styles.css:947` | Royal-Blau `#2557b7` auf Cream `#f7f7f1` | |
| `claude-classic` | `styles.css:854` | Bronze `#b98a44` auf Charcoal `#0d0f12` | |
| `claude-classic-light` | `styles.css:993` | (siehe styles.css) | |
| `claude-slate` | `styles.css:901` | Sky-Blue `#7eb8f6` auf GitHub-Dark `#0d1117` | |
| `claude-slate-light` | `styles.css:1039` | (siehe styles.css) | |

> Auch im File vorhanden, aber **NICHT in der Whitelist** und somit Dead-Code für die UI: `matrix` (`styles.css:714`), `matrix-light` (`styles.css:759`). Selektoren `ops-dark`, `premium-dark`, `sunset-brand` (`styles.css:156-158`) referenzieren nur `.kpi-card:hover` und definieren keine Theme-Blöcke. Empfehlung Etappe 1: **ignorieren / nicht entfernen** (read-only-Constraint).

### Default-Theme Bootstrap

Inline-Script in `src/routes/__root.tsx:49-85` — wird vor First Paint im `<head>` injected:

```ts
const THEME_STORAGE_KEY = 'claude-theme'
const DEFAULT_THEME = 'claude-nous'
const VALID_THEMES = [
  'claude-nous', 'claude-nous-light',
  'claude-official', 'claude-official-light',
  'claude-classic', 'claude-classic-light',
  'claude-slate', 'claude-slate-light',
]

const themeScript = `
(() => {
  const root = document.documentElement
  const storedTheme = localStorage.getItem('${THEME_STORAGE_KEY}')
  const theme = ${JSON.stringify(VALID_THEMES)}.includes(storedTheme)
    ? storedTheme : '${DEFAULT_THEME}'
  const lightThemes = ['claude-nous-light', 'claude-official-light',
                       'claude-classic-light', 'claude-slate-light']
  const isDark = !lightThemes.includes(theme)
  root.classList.remove('light', 'dark', 'system')
  root.classList.add(isDark ? 'dark' : 'light')
  root.setAttribute('data-theme', theme)
  root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')
  …
})()
`
```

Zusätzlich `themeColorScript` (`__root.tsx:87-115`): pflegt `<meta name="theme-color">` für die mobile Browser-Chrome-Färbung — ebenfalls mit `claude-nous` als Fallback.

### Tailwind `@theme` Block

**Nicht vorhanden.** `grep '@theme' src/**/*` (rekursiv) gibt nur einen Kommentar in `scifi-theme.css:258` zurück. Tailwind 4 wird über `@import 'tailwindcss'` (`styles.css:2`) plus `@variant dark` (`styles.css:5`) eingebunden — die Theme-Engine ist komplett custom (Plain-CSS-Variables + `data-theme`), Tailwind liefert ausschließlich Utility-Classes und den `dark:`-Variant.

**Implikation für Phase A:** Wir können den Shadcn-Standard-`@theme`-Block frei einführen, ohne mit einem existierenden Tailwind-Theme-Block zu kollidieren.

### Bridge-Mapping-Vorschlag — Hermes → Shadcn (Phase-A-Input, Winston-Hat)

**Strategie:** Token-Layer **NEU** anlegen, ohne `--theme-*` zu entfernen. Im neuen Layer werden Shadcn-Vars als `var(--theme-*)`-Aliase gebunden, sodass Hermes-Komponenten weiter mit `--theme-*` malen, Shadcn-Komponenten parallel mit `--background` / `--primary` etc. funktionieren. Pro `[data-theme=…]`-Block wird ein parallel-deklarierter Shadcn-Vars-Satz eingefügt.

| Hermes-Token | → Shadcn-Token | Begründung |
|---|---|---|
| `--theme-bg` | `--background` | App-Surface |
| `--theme-text` | `--foreground` | Primary-Foreground |
| `--theme-sidebar` | `--sidebar` (`--sidebar-background` für Shadcn-Sidebar-v2) | Eigene Sidebar-Surface, von `--background` getrennt |
| `--theme-panel` | `--muted` | Mid-Layer-Surface |
| `--theme-card` | `--card` | Card-Surface |
| `--theme-text` (in Card-Kontext) | `--card-foreground` | gleiche Text-Farbe |
| `--theme-card2` | `--popover` | Sekundär-Surface, Popover/Menus |
| `--theme-text` (in Popover-Kontext) | `--popover-foreground` | |
| `--theme-border` | `--border` | Standard-Border |
| `--theme-border-subtle` | `--input` (Border) + ggf. `--ring`-Tint | Subtiler Border = Form-Felder |
| `--theme-input` | `--input` (Background) | Form-Input-Surface |
| `--theme-accent` | `--primary` | Primary-Action |
| `--theme-bg` (Kontrast zum Accent) | `--primary-foreground` | Text auf Primary |
| `--theme-accent-subtle` | `--accent` | Hover/Selection-Tint |
| `--theme-accent` | `--accent-foreground` | Text auf Accent-Tint |
| `--theme-muted` | `--muted-foreground` | Sekundär-Text |
| `--theme-stripe` | `--secondary` | Zebra/Secondary-Surface |
| `--theme-text` | `--secondary-foreground` | |
| `--theme-danger` | `--destructive` | Destruktiv-Action |
| `--theme-bg` | `--destructive-foreground` | (oder #fff je nach Kontrast) |
| `--theme-focus` | `--ring` | Focus-Ring |
| `--theme-success` | (kein Shadcn-Standard, eigene `--success`) | nicht Teil von Shadcn-Core |
| `--theme-warning` | (kein Shadcn-Standard, eigene `--warning`) | |
| Radius (statisch) | `--radius` | Neue, Lokyy-globale Variable — Shadcn-Standard `0.5rem`, ggf. Lokyy-spezifischer Wert |

**Beispiel-Insertion (pro Theme-Block, in der späteren Phase A):**

```css
[data-theme='claude-nous'] {
  /* … bestehende --theme-*  bleibt unangetastet … */

  /* Shadcn-Bridge — NEW */
  --background: var(--theme-bg);
  --foreground: var(--theme-text);
  --card: var(--theme-card);
  --card-foreground: var(--theme-text);
  --popover: var(--theme-card2);
  --popover-foreground: var(--theme-text);
  --primary: var(--theme-accent);
  --primary-foreground: var(--theme-bg);
  --secondary: var(--theme-stripe);
  --secondary-foreground: var(--theme-text);
  --muted: var(--theme-panel);
  --muted-foreground: var(--theme-muted);
  --accent: var(--theme-accent-subtle);
  --accent-foreground: var(--theme-accent);
  --destructive: var(--theme-danger);
  --destructive-foreground: var(--theme-bg);
  --border: var(--theme-border);
  --input: var(--theme-input);
  --ring: var(--theme-focus);
  --radius: 0.5rem;
}
```

**Vorteile dieser Mapping-Strategie:**

1. **Zero functional change.** Hermes-Komponenten lesen weiter `--theme-*` — keine Code-Anpassung in `lokyy-workspace/` nötig.
2. **Reversibel.** Bridge-Block ist additiv; einfach Remove → Default-State zurück.
3. **Theme-getreu.** Shadcn-Komponenten erben automatisch das aktuell aktive Hermes-Theme (Default + alle 7 Varianten), ohne separates Switching.
4. **Lokyy-Branding via `claude-nous` overriden.** Etappe 1 setzt Lokyy-Accent (`--theme-accent`) im `claude-nous`-Block; Bridge propagiert ihn automatisch nach `--primary`.

**Offene Punkte (für Phase-A-Story zu klären):**

- Welche **drei Shadcn-Tokens** mappen wir auf welchen `--theme-shadow-*`? (Shadcn hat kein direktes Schatten-Token-Set — gehört in den Tailwind-`@theme`-Block, nicht in den Color-Layer.)
- `--success`, `--warning` — als Lokyy-eigene Tokens beibehalten (nicht-Shadcn-Standard, aber für Pulse-/Status-UI essenziell).
- `--radius`: Lokyy-spezifisch — Wert in Step 3.1 (Design-Konzept) festzulegen.
