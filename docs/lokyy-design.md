# Lokyy — Design-Konzept (Etappe 1, Step 3.1)

> Status: Vorgelegt zur Freigabe in Issue #13 (Checkpoint 2)
> Autor: Sally (bmad-agent-ux-designer)
> Datum: 2026-05-14

---

## Brand-Essenz

lokyy ist das **ruhige Cockpit eines selbst-gehosteten KI-Betriebssystems**. Die UI sagt: hier läuft etwas Ernsthaftes, lokal, unter deiner Kontrolle — kein Spielzeug, kein Cloud-Showroom. Klare Flächen, hoher Kontrast nur dort wo es Arbeit verlangt, ein einziger ruhiger Indigo-Akzent als Wegweiser. Kein Neon-Sci-Fi, kein erdiges Studio-Brown, keine Anime-Vibes — sondern die ungestresste Disziplin eines Shadcn-Dashboards mit eigener, leicht kühlerer Note.

## Schreibweise & Wordmark

- **Markenname:** **lokyy** (immer lowercase — in UI-Headern, Tab-Title, OG-Images, README-Titel, Logos).
- **Wo Caps erlaubt sind:** ausschliesslich als typografisches Stilmittel für Section-Headings im Sidebar/Dashboard-Stil (z.B. `DASHBOARD`, `KNOWLEDGE`, `JOBS`). Das ist Layout-Typografie, nicht Branding. Die Wortmarke selbst bleibt überall lowercase.
- **Tagline (Olivers Wahl, Checkpoint #13):** **`AI OPERATING SYSTEM`** — in ALL CAPS gesetzt, als typografisches Stilmittel auf einer Linie mit den Sidebar-Section-Headings.
  - **Wo sie erscheint:** Im Sidebar-Brand-Bereich als zweite Zeile unter dem Wordmark. Auch in Login/Splash, OG-Image, README-Header.
  - **Stil-Spec:** `font-size: 10.5px`, `letter-spacing: 0.18em`, `text-transform: uppercase`, `color: var(--muted-foreground)` — identisch zur Sidebar-Section-Heading-Typografie, damit Brand-Mark und Section-Headings als zusammenhängendes typografisches System wirken.
  - **In Main-UI-Header oder Top-Bar:** nicht — dort ist der Wordmark allein, sonst wird's redundant.

## Logo

**Design-Idee:** Ein abgerundetes Quadrat (die „lokale Box" — der eigene Server, der eigene Raum) mit einem **versetzten kleineren Punkt** innen oben-links (das KI-Element / der Denker im Raum). Lesbar als „Etwas läuft in einem Rahmen, der dir gehört". Geometrisch genug für Favicon-Grössen, aber distinct genug um nicht generisch zu wirken.

**SVG (single-color, 24×24 viewBox — Roh-Version):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-label="lokyy">
  <!-- Aussenform: gerundetes Quadrat = "die lokale Box" -->
  <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor"/>
  <!-- Innen-Punkt versetzt oben-links = "die KI im Raum" -->
  <circle cx="9" cy="9" r="2.5" fill="var(--logo-inner, #ffffff)"/>
</svg>
```

`currentColor` ist die Lokyy-Primary (Indigo). `--logo-inner` fällt im Dark Mode auf das Background-Surface (`#0B0D14`), im Light Mode auf reines Weiss — so wirkt der Punkt im Dark Mode wie ein „Loch" in der Box (mysteriöser), im Light Mode wie ein farbiger Akzent (cleaner).

**Skalierungs-Verhalten:**
- **16px (Favicon):** Box + Punkt klar erkennbar. Beide Formen >2px, kein Detail-Verlust. Lesbar.
- **24px (Sidebar-Icon):** Idealgrösse. Box-Korner-Radius (~5px in 24px-viewBox) wirkt distinct, aber nicht verspielt.
- **48px (App-Icon, Login):** Punkt-Innen tritt deutlich hervor, Wirkung „bewohnte Box".
- **128px+ (Splash, About):** Funktioniert auch ohne Detail-Ergänzung.

### Lockup-Variante (Symbol + Wordmark, Olivers Wahl in #13)

Horizontale Lockup für Header, README, Login, OG-Image, Splash. Symbol links, Wordmark rechts, vertikal mittig.

**SVG (124×24 viewBox):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 24" fill="none" aria-label="lokyy">
  <!-- Symbol: gerundetes Quadrat = "die lokale Box" -->
  <rect x="0" y="0" width="24" height="24" rx="5" fill="currentColor"/>
  <!-- Innen-Punkt versetzt oben-links = "die KI im Raum" -->
  <circle cx="7" cy="7" r="2.5" fill="var(--logo-inner, #ffffff)"/>
  <!-- Wordmark, Inter SemiBold, vertikal optisch mittig (Baseline 17 in 24-Höhe) -->
  <text x="34" y="17.5"
        font-family="Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        font-weight="600" font-size="18"
        letter-spacing="-0.02em"
        fill="currentColor">lokyy</text>
</svg>
```

**Verwendung:**
- Login/Splash: Lockup gross (256–360px breit), zentriert. Darunter optional `AI OPERATING SYSTEM` als Tagline-Caps mit 16px Abstand.
- README-Header: Lockup ~200px breit, links-bündig.
- OG-Image (1200×630): Lockup zentriert auf Lokyy-Dark-BG.
- Favicon-Set: nur Symbol (ohne Wordmark). Lockup ist nicht für 16/32/48px Icon-Slots gedacht.
- Sidebar im Workspace: weiterhin **Symbol + textuelles `<span>lokyy</span>`** (kein inline-SVG-Lockup, damit Tagline darunter auf eigener Zeile sauber sitzt — siehe Schreibweise & Wordmark oben).

**Monochrome-Lockup:** Falls für Print/Wasserzeichen: Symbol + Text als zwei Helligkeitsstufen derselben Farbe.

**Farbverhalten:**
- Light Mode: Box in `var(--primary)` (Indigo), Punkt in `#ffffff`.
- Dark Mode: Box in `var(--primary)` (Indigo, dieselbe Farbe), Punkt in `var(--background)` (Dark-Surface) → wirkt als Negativraum.
- Monochrome-Variante (für Favicon, OG-Image-Watermark): Box + Punkt als zwei Helligkeitsstufen derselben Farbe (90% / 30%-Lightness-Mix).

## Farbsystem

### Akzentfarbe (Primary)

**Finale Wahl: ein modernes Indigo mit leichtem Violett-Drift** — innerhalb des von Oliver vorgegebenen Korridors.

| Mode | OKLCH | Hex | Verwendung |
|---|---|---|---|
| **Dark** | `oklch(0.625 0.205 280)` | **#6E63F2** | Buttons, Links, Sidebar-Active, Focus-Ring |
| **Light** | `oklch(0.555 0.215 280)` | **#5848E0** | Gleiche Rollen, dunkler für AA-Kontrast auf Weiss |

**Rationale:** Hue `280` liegt zwischen klassischem Indigo (`265`) und Violett (`295`) — kühler als Shadcns Default-Indigo `#6366F1`, aber wärmer als reines Violett. Differenziert lokyy von:
- Hermes' `claude-nous` (Amber `#ffac02`) — diametral entgegengesetzt
- Hermes' `claude-official` (Indigo `#6366F1`, Hue ~265) — leicht violetter, eigene Identität
- Generischen Shadcn-Demos — wir kommen aus dem violet-shifted Sektor, nicht aus dem reinen Blue-Violet

Chroma `0.205` (Dark) / `0.215` (Light) ist hoch genug für eine sichtbare Brand-Präsenz, aber nicht so hoch dass es ins Pop-Art kippt. Lightness `0.625` Dark vs. `0.555` Light kompensiert den Surface-Kontrast (heller Primary auf dunklem BG, dunklerer Primary auf hellem BG) für AA-Konformität.

### Vollständige Token-Werte

Format: alle Shadcn-Tokens, je dark + light, in OKLCH mit Inline-Kommentaren.

#### Dark Mode (Default)

```css
.dark, [data-theme$="-dark"], [data-theme="lokyy-dark"] {
  /* Surfaces — gestaffelt: bg < sidebar/muted < card < popover */
  --background:             oklch(0.18 0.015 270);  /* #0B0D14 — App-BG, leicht violett-tinted neutral, nicht reines #000 (vermeidet Augen-Stress) */
  --foreground:             oklch(0.96 0.005 270);  /* #F2F3F7 — Primärtext, fast weiss, minimaler Cool-Tint matched die Primary */
  --card:                   oklch(0.22 0.015 270);  /* #131521 — Cards heben sich 4% L von BG, klare Schicht ohne Border-Stütze */
  --card-foreground:        oklch(0.96 0.005 270);  /* gleich foreground */
  --popover:                oklch(0.24 0.018 270);  /* #171A28 — Popover/Menus eine weitere Stufe heller als Card */
  --popover-foreground:     oklch(0.96 0.005 270);
  --primary:                oklch(0.625 0.205 280); /* #6E63F2 — Lokyy-Indigo, siehe oben */
  --primary-foreground:     oklch(0.98 0.005 270);  /* #FAFAFC — fast weiss, hoher Kontrast auf Indigo */
  --secondary:              oklch(0.28 0.012 270);  /* #1E2130 — Secondary-Surface, für Tabs/Chips */
  --secondary-foreground:   oklch(0.96 0.005 270);
  --muted:                  oklch(0.25 0.012 270);  /* #181B27 — Muted-Surface für Panels/Hover-Backgrounds */
  --muted-foreground:       oklch(0.68 0.012 270);  /* #9CA0AE — Sekundär-Text, lesbar aber sekundär */
  --accent:                 oklch(0.32 0.05 280);   /* #252740 — Accent-Tint für Hover/Selected-Item-BG, gefärbt zur Primary */
  --accent-foreground:      oklch(0.96 0.005 270);  /* Text auf Accent-Tint bleibt foreground, kein farbiger Text */
  --destructive:            oklch(0.62 0.22 27);    /* #E25A4D — warmes Rot, nicht Hermes' #fb2c36 (zu Pink) */
  --destructive-foreground: oklch(0.98 0.005 270);
  --border:                 oklch(0.28 0.012 270);  /* #1E2130 — sichtbar aber nicht schreiend, matched secondary */
  --input:                  oklch(0.24 0.012 270);  /* #171A26 — Input-BG knapp über Card, klar als interaktive Fläche erkennbar */
  --ring:                   oklch(0.625 0.205 280); /* gleich primary — Focus-Ring ist immer Brand */

  /* Sidebar-spezifisch — Shadcn-v2 Sidebar-Tokens, eigene Surface-Stufe */
  --sidebar:                oklch(0.20 0.015 270);  /* #0F1119 — leicht heller als bg, klare Trennung Sidebar/Content */
  --sidebar-foreground:     oklch(0.92 0.008 270);  /* #E4E5EC — leicht gedimmt vs. main foreground */
  --sidebar-primary:        oklch(0.625 0.205 280); /* Sidebar-Active-BG (gefüllter Indikator, kein Border) */
  --sidebar-primary-foreground: oklch(0.98 0.005 270);
  --sidebar-accent:         oklch(0.26 0.015 270);  /* #1B1D2A — Hover-BG für Sidebar-Items */
  --sidebar-accent-foreground: oklch(0.96 0.005 270);
  --sidebar-border:         oklch(0.24 0.012 270);  /* #171A26 — Sidebar-Section-Separator */
  --sidebar-ring:           oklch(0.625 0.205 280); /* gleich ring */

  /* Lokyy-Eigentokens (kein Shadcn-Standard, aber wir brauchen sie) */
  --success:                oklch(0.70 0.16 155);   /* #4FCB7C — frisches Grün, weniger giftig als Hermes' #8fff89 */
  --warning:                oklch(0.78 0.16 75);    /* #E5B547 — warmes Gelb, klar als Warning erkennbar */
  --info:                   oklch(0.70 0.13 230);   /* #5CB6E0 — Sky-Blue, distinct von Primary (Hue 230 vs 280) */
}
```

#### Light Mode

```css
:root, [data-theme$="-light"], [data-theme="lokyy-light"] {
  --background:             oklch(0.99 0.003 270);  /* #FBFBFD — fast weiss mit Hauch Cool, nicht reines #fff (weniger Glare) */
  --foreground:             oklch(0.22 0.020 270);  /* #16182A — fast schwarz mit Indigo-Tint, kein reines #000 */
  --card:                   oklch(1.00 0 0);         /* #FFFFFF — Cards sind reines Weiss, heben sich von BG ab */
  --card-foreground:        oklch(0.22 0.020 270);
  --popover:                oklch(1.00 0 0);         /* #FFFFFF — wie Card */
  --popover-foreground:     oklch(0.22 0.020 270);
  --primary:                oklch(0.555 0.215 280); /* #5848E0 — dunklerer Lokyy-Indigo für AA auf Weiss */
  --primary-foreground:     oklch(0.99 0.003 270);  /* fast weiss auf Indigo */
  --secondary:              oklch(0.95 0.010 270);  /* #EEEFF5 — leichter Cool-Grey für Chips/Tabs */
  --secondary-foreground:   oklch(0.22 0.020 270);
  --muted:                  oklch(0.96 0.008 270);  /* #F1F2F7 — Muted-Panel-BG */
  --muted-foreground:       oklch(0.50 0.015 270);  /* #6B6F7E — Sekundär-Text, lesbar auf hell */
  --accent:                 oklch(0.94 0.025 280);  /* #E8E6F8 — Indigo-getintetes Hover-BG */
  --accent-foreground:      oklch(0.40 0.180 280);  /* #5B4FBE — dunkleres Indigo als Text auf Accent-Tint */
  --destructive:            oklch(0.55 0.23 27);    /* #C73E32 — dunkleres Rot für Weiss-Hintergrund */
  --destructive-foreground: oklch(0.99 0.003 270);
  --border:                 oklch(0.92 0.008 270);  /* #E5E6ED — dezenter Border, sichtbar aber nicht hart */
  --input:                  oklch(1.00 0 0);         /* Weiss-Inputs auf hellem BG, mit Border-Definition */
  --ring:                   oklch(0.555 0.215 280); /* gleich primary */

  --sidebar:                oklch(0.97 0.006 270);  /* #F4F5F9 — leicht abgesetzt vom Main-BG */
  --sidebar-foreground:     oklch(0.28 0.018 270);
  --sidebar-primary:        oklch(0.555 0.215 280);
  --sidebar-primary-foreground: oklch(0.99 0.003 270);
  --sidebar-accent:         oklch(0.93 0.012 270);  /* #E8E9F1 — Hover-BG */
  --sidebar-accent-foreground: oklch(0.22 0.020 270);
  --sidebar-border:         oklch(0.90 0.008 270);
  --sidebar-ring:           oklch(0.555 0.215 280);

  --success:                oklch(0.58 0.15 155);   /* #3A9C5E — gedeckteres Grün auf Weiss */
  --warning:                oklch(0.66 0.16 75);    /* #B8862D — gedecktes Amber */
  --info:                   oklch(0.58 0.13 230);   /* #3A87B8 — gedecktes Sky-Blue */
}
```

## Radius-Skala

```css
:root {
  --radius:    0.625rem;                       /* 10px Default — Cards, Inputs, Buttons, Popover */
  --radius-sm: calc(var(--radius) - 4px);      /*  6px — kleine Inputs, Badges, Chips */
  --radius-md: var(--radius);                  /* 10px — Default-Alias */
  --radius-lg: calc(var(--radius) + 4px);      /* 14px — Dialog, grosse Cards, Sidebar-Section-Container */
  --radius-xl: calc(var(--radius) + 8px);      /* 18px — Hero-Surfaces, Onboarding-Panels */
}
```

**Wahl: 0.625rem (10px) statt der Shadcn-Default-0.5rem (8px).** Begründung: lokyys Sidebar+Card+Popover-Stapelung wirkt mit 10px sichtbar weicher und „premium", ohne in Pill-Territorium zu rutschen. Bei 8px wirken die Cards auf dem Dashboard etwas zu rechtwinklig-flat im Vergleich zu modernen Referenzen (Linear, Vercel, ShadcnUIKit). 10px ist auch die gängige Default-Wahl in den Shadcn-UIKit-Dashboards die Oliver als Referenz nannte.

## Bridge-Mapping zu Hermes-Tokens

Dies ist der **Implementierungs-Vertrag für Phase A**. Jede Hermes `--theme-*`-Variable bekommt ein Shadcn-Alias, sodass existierender Hermes-Code mit `var(--theme-*)` weiter funktioniert und Shadcn-Komponenten mit `var(--background)`/`var(--primary)` die gleichen Werte erhalten — **ohne dass `.tsx` angefasst werden muss**.

**Strategie:** Pro `[data-theme=…]`-Block (alle 8 Hermes-Themes in `styles.css`) wird ein paralleler Shadcn-Vars-Satz **eingefügt**, der die Lokyy-Werte aus der Token-Tabelle oben definiert. Hermes-Themes bleiben weiterhin selectable (Settings-UI bricht nicht), aber `claude-nous` (Default) wird umdefiniert auf den Lokyy-Look. Die anderen 7 Themes bleiben als „Hermes-Originals" wählbar — Entscheidung ob die in Phase D/E entfernt werden gehört nicht in Step 3.1.

### Vollständige Mapping-Tabelle

| Hermes-Var (`--theme-*`) | Shadcn-Alias / Lokyy-Token | Bemerkung |
|---|---|---|
| `--theme-bg` | `--background` | App-Surface |
| `--theme-sidebar` | `--sidebar` | Sidebar-Surface (Shadcn-v2 Sidebar-Token) |
| `--theme-panel` | `--muted` | Mid-Layer-Surface (Panel/Sub-Card) |
| `--theme-card` | `--card` | Card-Surface |
| `--theme-card2` | `--popover` | Popover/Menu-Surface |
| `--theme-border` | `--border` | Standard-Border |
| `--theme-border-subtle` | `--sidebar-border` | Subtiler Border = Sidebar-Section-Trennung |
| `--theme-text` | `--foreground` | Primärtext (auch `--card-foreground`, `--popover-foreground` als Re-Alias) |
| `--theme-muted` | `--muted-foreground` | Sekundär-Text |
| `--theme-shadow-1` | **Lokyy-Eigentoken** `--shadow-sm` | Kein Shadcn-Color-Token-Match — bleibt als Lokyy-Shadow erhalten |
| `--theme-shadow-2` | **Lokyy-Eigentoken** `--shadow-md` | Wie oben |
| `--theme-shadow-3` | **Lokyy-Eigentoken** `--shadow-lg` | Wie oben |
| `--theme-glass` | **Lokyy-Eigentoken** `--glass` | Glas-Overlay, kein Shadcn-Match — bleibt eigenständig |
| `--theme-focus` | `--ring` | Focus-Ring |
| `--theme-accent` | `--primary` | Primary-Action |
| `--theme-accent-secondary` | `--accent-foreground` | Sekundärer Akzent (Text auf Accent-Tint) |
| `--theme-accent-subtle` | `--accent` | Hover/Selection-Tint (BG) |
| `--theme-accent-border` | (no direct map) | Implizit über `--primary`+Opacity in Komponenten — kein eigenes Token |
| `--theme-active` | `--sidebar-primary` | Active-State (Sidebar-Active-BG, gefüllt) |
| `--theme-link` | `--primary` | Links nutzen Primary-Farbe |
| `--theme-success` | **Lokyy-Eigentoken** `--success` | Nicht im Shadcn-Core |
| `--theme-warning` | **Lokyy-Eigentoken** `--warning` | Nicht im Shadcn-Core |
| `--theme-danger` | `--destructive` | Destruktive Action |
| `--theme-stripe` | `--secondary` | Zebra/Secondary-Surface |
| `--theme-header-bg` | `--background` | Header übernimmt App-BG |
| `--theme-header-border` | `--border` | Header-Trennlinie = Standard-Border |
| `--theme-input` | `--input` | Form-Input-Surface |

**Lokyy-Eigentokens (nicht-Shadcn-Standard, bleiben als parallel verfügbare Variablen):**

```css
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.4);          /* Dark — auf Light entsprechend reduziert */
--shadow-md: 0 6px 16px oklch(0 0 0 / 0.35);
--shadow-lg: 0 16px 36px oklch(0 0 0 / 0.45);
--glass:     oklch(0.18 0.015 270 / 0.88);          /* dark glass, matched --background mit Alpha */
```

Im Light-Mode entsprechend mit hellem BG + sehr niedriger Alpha.

### Beispiel-Insertion (für Phase A in `styles.css`, im `[data-theme='claude-nous']`-Block)

```css
[data-theme='claude-nous'] {
  /* … bestehende Hermes --theme-* bleiben unangetastet (read-only-Constraint) … */

  /* === Lokyy-Bridge — NEU eingefügt durch Phase A === */
  --background:             oklch(0.18 0.015 270);
  --foreground:             oklch(0.96 0.005 270);
  --card:                   oklch(0.22 0.015 270);
  --card-foreground:        oklch(0.96 0.005 270);
  --popover:                oklch(0.24 0.018 270);
  --popover-foreground:     oklch(0.96 0.005 270);
  --primary:                oklch(0.625 0.205 280);   /* Lokyy-Indigo */
  --primary-foreground:     oklch(0.98 0.005 270);
  --secondary:              oklch(0.28 0.012 270);
  --secondary-foreground:   oklch(0.96 0.005 270);
  --muted:                  oklch(0.25 0.012 270);
  --muted-foreground:       oklch(0.68 0.012 270);
  --accent:                 oklch(0.32 0.05 280);
  --accent-foreground:      oklch(0.96 0.005 270);
  --destructive:            oklch(0.62 0.22 27);
  --destructive-foreground: oklch(0.98 0.005 270);
  --border:                 oklch(0.28 0.012 270);
  --input:                  oklch(0.24 0.012 270);
  --ring:                   oklch(0.625 0.205 280);
  --sidebar:                oklch(0.20 0.015 270);
  --sidebar-foreground:     oklch(0.92 0.008 270);
  --sidebar-primary:        oklch(0.625 0.205 280);
  --sidebar-primary-foreground: oklch(0.98 0.005 270);
  --sidebar-accent:         oklch(0.26 0.015 270);
  --sidebar-accent-foreground: oklch(0.96 0.005 270);
  --sidebar-border:         oklch(0.24 0.012 270);
  --sidebar-ring:           oklch(0.625 0.205 280);
  --radius:                 0.625rem;
  --success:                oklch(0.70 0.16 155);
  --warning:                oklch(0.78 0.16 75);
  --info:                   oklch(0.70 0.13 230);
}
```

Für `claude-nous-light` derselbe Block mit den Light-Mode-Werten. Die anderen 6 Themes (`claude-official`, `claude-classic`, `claude-slate` × dark/light) **bekommen den gleichen Lokyy-Bridge-Block** — das überschreibt deren Hermes-Original-Akzentfarben unter Shadcn-Komponenten. Hermes-Komponenten in diesen Themes bleiben mit ihren Original-`--theme-*`-Werten farblich erkennbar als Hermes-Themes; Shadcn-Komponenten sehen überall Lokyy aus. Falls Oliver später entscheidet, dass Hermes-Themes weg sollen, ist das eine Phase-D/E-Frage (Sidebar-Settings-Eintrag), nicht Phase A.

## Mood-Statement

Wer lokyy aufmacht, sieht zuerst eine **schmale dunkle Sidebar mit Section-Headings in Caps (`DASHBOARD`, `KNOWLEDGE`), einer gefüllten Indigo-Pille als Active-Indicator und einer Top-Bar mit Breadcrumbs**. Keine Avatare, keine Animationen, keine Glow-Effekte — nur ruhig gestaffelte Surfaces (App-BG → Sidebar → Card → Popover, je ~4% Lightness-Sprung), ein einziger Indigo-Akzent für alles was klickbar oder aktiv ist, und Text in einem fast weissen `#F2F3F7` mit leichtem Cool-Tint. Im Vergleich zum Hermes-Workspace, der mit Amber-Akzenten, JetBrains-Mono-Headers und Sci-Fi-Cinematic-Vibes bewusst „nerdy power user" sagt, geht lokyy in die Richtung **„ernsthaftes Werkzeug, sauber dokumentierbar, screenshot-fähig für ein B2B-Pitch-Deck"**. Wo Hermes Cinema ist, ist lokyy Cockpit. Wo Hermes „cool" sein will, will lokyy „korrekt" sein. Im Light Mode kippt die UI zu einer sehr hellen, fast `#FBFBFD`-weissen Fläche mit Cards in reinem `#FFFFFF` — Shadcn-Standard-Look, ohne grafisches Gimmick.

## Was sich gegenüber Hermes ändert (sichtbar)

- **Akzentfarbe komplett anders.** Amber `#ffac02` → Indigo `#6E63F2`. Jede Hervorhebung (Button, Link, Active, Focus, Progress, Charts) wechselt sichtbar.
- **App-Background-Farbton.** Teal-Black `#041c1c` (kühl-grünlich) → Indigo-Tinted-Black `#0B0D14` (kühl-violett-neutral).
- **Schriftfarbe.** Cream `#ffe6cb` → fast weiss `#F2F3F7` — deutlich neutraler und weniger „candle-lit".
- **Sidebar-Active-State.** Hermes nutzt einen linken farbigen Border + Background-Tint. Lokyy nutzt eine **gefüllte Indigo-Pille** über das ganze Item — kein Border-Indicator. Shadcn-Dashboard-Stil.
- **Section-Headings in der Sidebar.** Vorher Titel-Case, jetzt **ALL CAPS** mit reduzierter Schriftgrösse und erhöhtem `letter-spacing` (`DASHBOARD`, `KNOWLEDGE`) — typografisches Stilmittel.
- **Logo.** Hermes' Logo-Set → Lokyy-Symbol (gerundetes Quadrat mit versetztem Innenpunkt). Wordmark bleibt lowercase.
- **Border-Definitionen.** Hermes nutzt `rgba(255,230,203,0.2)` (warm cream-tinted) → Lokyy nutzt neutrale Cool-Greys (`#1E2130` Dark, `#E5E6ED` Light) — schärfere Card-Trennung.
- **Radius weicher.** Hermes-Buttons/Inputs wirken etwas eckiger; lokyy 10px-Default macht alles dezent weicher.

## Was sich NICHT ändert (Brief-Constraint)

- **Sidebar-Navigations-Punkte bleiben identisch** (Dashboard, Chat, Files, Terminal, Jobs, Kanban, Conductor, Operations, Swarm in Main + Memory, Skills, MCP, Profiles in Knowledge — vgl. `recon/layout-shell.md`).
- **Memory und Knowledge bleiben unverändert** als Sidebar-Sections.
- **Interne Code-Bezeichner bleiben** (`"name": "hermes-workspace"` in package.json, Theme-IDs `claude-nous` etc., Komponenten-Namen, Zustand-Stores).
- **`LICENSE`-Datei bleibt verbatim** (MIT, Eric/outsourc-e).
- **Keine Funktionsänderungen** — Reskin bedeutet ausschliesslich Aussehen. SSE, Conductor, Jobs, Cron, Skills, Memory, MCP unverändert.
- **Hermes-Theme-Familien bleiben in der Whitelist** (`claude-official`, `claude-classic`, `claude-slate` × dark/light) — werden nur unter Shadcn-Komponenten mit dem Lokyy-Look überschrieben; Entscheidung ob die Themes vollständig entfernt werden gehört nach Phase D/E.

---

## Geklärt durch Oliver (Checkpoint #13, 2026-05-14)

Alle vier Punkte sind entschieden und in den vorhergehenden Sections eingearbeitet:

1. **Tagline → `AI OPERATING SYSTEM`** (in ALL CAPS). Sitzt im Sidebar-Brand-Bereich auf zweiter Zeile unter dem Wordmark, gleiche Typografie wie Sidebar-Section-Headings. Auch in Login/Splash, OG-Image, README. Nicht in Main-UI-Header. → siehe „Schreibweise & Wordmark".
2. **Hermes-Theme-Whitelist → bleibt erhalten.** Alle 8 Themes (`claude-nous`, `claude-official`, `claude-classic`, `claude-slate` je dark/light) bleiben in der `__root.tsx`-Whitelist und in der Settings-UI selectable. Lokyy-Bridge-Block wird pro Theme additiv eingefügt — Shadcn-Komponenten zeigen überall den Lokyy-Look, Hermes-Komponenten behalten pro Theme ihre Hermes-Charakteristik. Entfernen einzelner Themes ist explizit kein Etappe-1-Scope.
3. **Logo → Symbol + Wordmark als Lockup-Variante** zusätzlich zum reinen Symbol. Lockup-SVG (124×24 viewBox) ist oben in der Logo-Section ergänzt. Verwendung: Login, Splash, README, OG-Image, Header-Lockups. Sidebar im Workspace nutzt Symbol + separates Wordmark-`<span>` damit die Tagline auf eigener Zeile darunter passt.
4. **Destructive-Hue → Option A bestätigt** (`oklch(0.62 0.22 27)` = `#E25A4D`, warmes Orange-Rot). Bleibt wie in der Token-Tabelle dokumentiert. Tonal kompatibler mit der Indigo-Palette als Hermes' kühleres Pink-Rot.

→ Mit allen vier Antworten ist Checkpoint #13 erledigt. Phase A (#14) kann starten.
