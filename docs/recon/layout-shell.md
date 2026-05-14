# Recon Findings — Layout-Shell & Sidebar

> **Mary (Business Analyst)** — Issue #7, Step 2.4 of Etappe 1
> Quelle: `lokyy-workspace/` (read-only)
> Stand: 2026-05-14

---

## 2.4 Layout-Shell & Sidebar

### Shell-Datei

- **Pfad:** `lokyy-workspace/src/components/workspace-shell.tsx`
- **Zeilen:** 463
- **Komponente:** `WorkspaceShell` (default export, named)
- **Konsumiert in:** Root-Route via TanStack Router; wrappt `<Outlet />` als `children`.

**Layout-Strategie:** CSS Grid mit dynamischem Spalten-Template (workspace-shell.tsx:342-347).

```tsx
grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden
md:grid-cols-[auto_1fr]   // Desktop: Sidebar (auto) + Content (1fr)
md:grid-cols-1            // Wenn hideChatSidebar oder chrome-free
```

**Regionen-Map (Desktop):**

```
┌────────────────────────────────────────────────────────────────┐
│ [Electron Titlebar h-10] (optional, isElectron)        L317   │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                     │
│ Sidebar  │  <main> — Content-Region                            │
│ (auto    │  ├─ TerminalWorkspace (persistent, hidden/shown)    │
│  width,  │  │   L389-414                                       │
│  z-30)   │  ├─ page-transition wrapper                         │
│ L350-367 │  │   ├─ MobilePageHeader (mobile only) L426-430    │
│          │  │   └─ {children} (TanStack Outlet) L431          │
│          │  └─ ChatPanel (non-chat-routes, desktop) L436      │
├──────────┴─────────────────────────────────────────────────────┤
│ SystemMetricsFooter (optional, conditional)              L457 │
└────────────────────────────────────────────────────────────────┘

Overlays (fixed/portal):
- ChatPanelToggle (floating button)                       L440
- DESKTOP_SIDEBAR_BACKDROP (dim layer)                    L442-449
- ConnectionStartupScreen (boot splash)                   L451-453
- MobileHamburgerMenu (mobile)                            L456
- CommandPalette                                          L460
- ClaudeReconnectBanner                                   L315
```

**Sichtbarkeits-Gates:**

| Region | Bedingung | Quelle |
|---|---|---|
| Desktop-Sidebar | `!isChromeFreeSurface && !isMobile && !hideChatSidebar` | shell:350 |
| ChatPanel | `!isOnChatRoute && !isOnPlaygroundRoute && !isChromeFreeSurface && !isMobile` | shell:436 |
| SystemMetricsFooter | `!isChromeFreeSurface && !isMobile && !isOnChatRoute && settings.showSystemMetricsFooter` | shell:457 |
| ChromeFreeSurface | `?embed=1` oder `/hermes-world`, `/world` Routes — return `<>{children}</>` | shell:294 |

**Chat-Focus-Mode:** `hideChatSidebar = isOnChatRoute && chatFocusMode` → Sidebar entfällt, grid kollabiert zu 1 Spalte (shell:195, 345).

---

### Sidebar-Datei

- **Pfad:** `lokyy-workspace/src/screens/chat/components/chat-sidebar.tsx`
- **Zeilen:** 1314
- **Export:** `ChatSidebar` (memoized via `MemoizedChatSidebar`, L1312-1314)
- **Verbreitete Breiten:** collapsed 48px / expanded 300px Desktop · 85vw (max 360) Mobile (chat-sidebar.tsx:892-898)

**Sektionsstruktur (von oben nach unten):**

1. Header (Logo + Collapse-Toggle) — L919-989
2. Search-Button — L992-1005
3. New-Session-Link — L1007-1033
4. HermesWorld-Featured-Link (Castle, NEW-Badge, gated by `VITE_HERMESWORLD_ENABLED`) — L1035-1073
5. Scrollable Body: **Main** Section → **Knowledge** Section → **System** Section (currently empty) → Sessions-List — L1076-1152
6. Footer: User-Avatar-Menu + Settings-Button + ThemeToggleMini — L1156-1233

---

### Vollständige Nav-Punkte-Liste (Phase C übernimmt 1:1)

Reihenfolge wie im DOM gerendert. **Memory + Skills bleiben unverändert.**

#### Section: **Main** (`mainItems`, chat-sidebar.tsx:783-849)

| # | Label | Route (`to`) | Icon (Hugeicons) | File:Line |
|---|---|---|---|---|
| 1 | `t('nav.dashboard')` | `/dashboard` | `DashboardSquare01Icon` | chat-sidebar.tsx:784-790 |
| 2 | `t('nav.chat')` | `/chat` | `MessageMultiple01Icon` | chat-sidebar.tsx:791-797 |
| 3 | `t('nav.files')` | `/files` | `File01Icon` | chat-sidebar.tsx:799-805 |
| 4 | `t('nav.terminal')` | `/terminal` | `ComputerTerminal01Icon` | chat-sidebar.tsx:806-812 |
| 5 | `t('nav.jobs')` | `/jobs` | `Clock01Icon` | chat-sidebar.tsx:813-819 |
| 6 | `Kanban` (literal) | `/tasks` | `CheckListIcon` | chat-sidebar.tsx:820-826 |
| 7 | `Conductor` (literal) | `/conductor` | `Rocket01Icon` | chat-sidebar.tsx:827-833 |
| 8 | `Operations` (literal) | `/operations` | `UserMultipleIcon` | chat-sidebar.tsx:834-840 |
| 9 | `Swarm` (literal) | `/swarm` | `UserGroupIcon` | chat-sidebar.tsx:841-847 |

#### Section: **Knowledge** (`knowledgeItems`, chat-sidebar.tsx:851-881) — *bleibt vollständig wie ist*

| # | Label | Route (`to`) | Icon (Hugeicons) | File:Line |
|---|---|---|---|---|
| 10 | `t('nav.memory')` | `/memory` | `BrainIcon` | chat-sidebar.tsx:852-858 |
| 11 | `t('nav.skills')` | `/skills` | `PuzzleIcon` | chat-sidebar.tsx:859-866 |
| 12 | `MCP` (literal) | `/mcp` | `McpServerIcon` | chat-sidebar.tsx:867-873 |
| 13 | `t('nav.profiles')` | `/profiles` | `UserMultipleIcon` | chat-sidebar.tsx:874-880 |

#### Section: **System** (`systemItems`, chat-sidebar.tsx:883)

Aktuell leer (`const systemItems: Array<NavItemDef> = []`). Settings-Eingang sitzt im Footer-Menu, nicht in der Section.

#### Standalone above sections

| # | Label | Route | Icon | File:Line |
|---|---|---|---|---|
| S0 | `Search` (button, öffnet Modal) | (kein `to`) | `Search01Icon` | chat-sidebar.tsx:773-779 |
| S1 | `New Session` (Link) | `/chat/$sessionKey` (params: `new`) | `PencilEdit02Icon` | chat-sidebar.tsx:1010-1031 |
| S2 | `HermesWorld` (+ NEW-Badge) | `/playground` | `Castle02Icon` (gold) | chat-sidebar.tsx:1040-1071 |

#### Footer-Region (chat-sidebar.tsx:1156-1232)

- User-Menu-Trigger mit Avatar + StatusDot — öffnet MenuContent mit Settings-Eintrag
- Settings-Button (Quick-Access) — L1217-1228
- ThemeToggleMini (Sun/Moon icon) — L1229 (`ThemeToggleMini`-Definition L69-122)

---

### Mobile-Strategie

**Befund:** Die Shell mountet **beide** Layouts (Desktop + Mobile) gleichzeitig und schaltet via Media-Query / Flags ein/aus — keine getrennten Layout-Roots. Mobile-spezifische Komponenten werden zusätzlich konditional in der Shell gerendert.

**Detection:** `window.matchMedia('(max-width: 767px)')` mit React-State + listener (shell:233-239, chat-sidebar.tsx:682-688). Breakpoint = 768px.

**Mobile-Komponenten (alle in `lokyy-workspace/src/components/` außer wo vermerkt):**

| Komponente | Datei | In Shell verwendet @ |
|---|---|---|
| `MobileTabBar` | `mobile-tab-bar.tsx` | importiert shell:35, gemountet via `MobileHamburgerMenu` |
| `MobileHamburgerMenu` | `mobile-hamburger-menu.tsx` | shell:36, shell:456 |
| `MobilePageHeader` | `mobile-page-header.tsx` | shell:37, shell:399-401, shell:426-430 |
| `MobileTerminalInput` | `terminal/mobile-terminal-input.tsx` | shell:39, shell:413 |
| `MobileSessionsPanel` | `mobile-sessions-panel.tsx` | (nicht in Shell direkt — separat genutzt) |
| `MobilePromptTrigger` / `MobileSetupModal` | `mobile-prompt/*.tsx` | (off-shell) |
| `use-mobile-keyboard` (hook) | `hooks/use-mobile-keyboard.ts` | shell:41, shell:82 |
| `use-chat-mobile` (hook) | `screens/chat/hooks/use-chat-mobile.ts` | (off-shell) |

**Verhalten:**

- Sidebar `isMobile` → fixed positioned (`fixed inset-y-0 left-0 z-50`), 85vw breit, pointer-events deaktiviert wenn collapsed (chat-sidebar.tsx:710-716, 916).
- Pfad-Wechsel collapsed die Mobile-Sidebar automatisch (shell:251-254).
- `MobileTabBar` definiert eigene `MOBILE_NAV_TABS`-Liste (mobile-tab-bar.tsx:48-134), Reihenfolge: Home, Chat, Play, Files, Terminal, Jobs, Swarm, Memory, Skills, MCP, Profiles, Settings. **Diese Liste lebt eigenständig**, deckt sich aber inhaltlich mit der Sidebar (zzgl. Settings, ohne Kanban/Conductor/Operations).
- `getTabIndex` in der Shell (shell:95-108) dupliziert die Tab-Reihenfolge für Slide-Transitions.
- Swipe-Navigation: `useSwipeNavigation` (shell:31, 79).

**Konsequenz für Etappe 1 (beobachtet, nicht bewertet):** Visuelle Reskins müssen sowohl `chat-sidebar.tsx` (Desktop + responsive Mobile-Branch) als auch `mobile-tab-bar.tsx` separat berücksichtigen, falls die Bottom-Tab-Leiste mit-skinnt. Die `MOBILE_NAV_TABS`-Liste ist in einem zweiten Schritt zu spiegeln, falls Phase C die Labels anpasst.

---

### Begleit-Hinweise

- **Branding-Strings für späteres Reskin (außerhalb Issue #7 Scope, nur als Beobachtung):** `Hermes Workspace`-Titel chat-sidebar.tsx:948; `Hermes`-Titlebar shell:336; `HermesWorld`-Link chat-sidebar.tsx:1058.
- **Theme-Keys:** Sidebar nutzt CSS-Variablen `--theme-sidebar`, `--theme-bg`, `--theme-text`, `--theme-muted`, `--theme-accent`, `--theme-border`, `--theme-panel`, `--titlebar-h`, `--vvh`, `--tabbar-h`. Keine Hardcodes außer Gold-Gradient (`#fde68a → #fbbf24 → #d4a017`) für HermesWorld-Badge.
- **i18n:** Labels mit `t('nav.…')` aus `@/lib/i18n` — Übersetzungsfile ist die Single-Source-of-Truth für Labels Dashboard, Chat, Files, Terminal, Jobs, Memory, Skills, Profiles. Direct-Literals: Kanban, Conductor, Operations, Swarm, MCP, Search, New Session, HermesWorld.
