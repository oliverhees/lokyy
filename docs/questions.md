# Open Questions for Oliver

Items that require Oliver's decision before work can proceed.

---

## Lizenz (OFFEN — für Anwaltsgespräch)

**Status:** Offen
**Wer entscheidet:** Oliver (juristische Beratung empfohlen)

Lokyy soll später kommerziell angeboten werden. Die Hermes-Workspace-MIT-Lizenz erlaubt Forks und kommerzielle Nutzung, verlangt aber Beibehaltung des Copyright-Vermerks. Die strategische Frage — ob Lokyy selbst Open Source bleibt (Open Core), proprietär wird, oder ein anderes Modell — ist offen. Diese Entscheidung sollte **vor dem ersten öffentlichen Release** mit juristischer Beratung getroffen werden.

**Kontext:** `docs/licensing-todo.md` (wird in Step 2 befüllt) enthält die Lizenzinventarisierung aller Stack-Komponenten als Entscheidungsgrundlage.

---

## Visuelle Verifikation auf Linux (Q-002 — entscheiden VOR Phase A)

**Status:** Offen — getrackt als [Issue #22](https://github.com/oliverhees/lokyy/issues/22)
**Trifft auf:** Issue [#14](https://github.com/oliverhees/lokyy/issues/14) (Phase A) und alle nachfolgenden Reskin-Issues
**Aufgetaucht in:** Issue [#3](https://github.com/oliverhees/lokyy/issues/3)

CLAUDE.md (global, Oliver's PAI-Regel) schreibt vor: **„Interceptor for ALL web verification."** Aber: Interceptor CLI ist auf diesem Linux-System (Pop!_OS) nicht installiert — die Skill-Installations-Pfade sind Mac-spezifisch (`/opt/homebrew/bin/`, `~/Projects/interceptor`). Chrome läuft (PID 14304), aber die Extension + Native Messaging Bridge fehlen.

**Für Issue #3** (Workspace startet) reicht HTTP-Level-Verifikation (curl + Dev-Server-Log) — siehe Closing-Comment.

**Für Phase A onward** (Token-Layer, UI-Primitives, Layout-Shell) brauchen wir echte visuelle Verifikation. Optionen:

| Option | Aufwand | Treue |
|--------|---------|------|
| A: Interceptor auf Linux installieren (Chrome-Extension + Daemon + Native-Messaging-Manifest selbst bauen) | ~1h Setup, eigenes Issue | Real Chrome ✅ |
| B: Playwright nutzen (ist bereits als Dep im Workspace, `node_modules/playwright`) | 5min, ein kleines TS-Script | Headless Chromium (verstößt gegen CLAUDE.md-Regel) |
| C: agent-browser CLI (Browser-Skill) | mittlerer Aufwand | Headless via CDP (verstößt gegen CLAUDE.md-Regel) |
| D: Manuelle Chrome-Screenshots durch Oliver pro Phase | 0 für mich, etwas für Oliver | Real Chrome ✅ |

**Empfehlung:** Option A separat als Setup-Issue tracken und VOR Issue #14 abschließen. Alternativ Option D als pragmatischer Fallback.

**Bitte entscheiden:** A, B, C oder D — und ob jetzt oder erst kurz vor Phase A.

---

## Weitere Fragen (werden laufend ergänzt)

*Noch keine weiteren offenen Punkte.*
