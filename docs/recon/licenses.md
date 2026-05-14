# Recon-Findings — Lizenzen

> **Frame:** Faktensammlung für Olivers Anwaltsgespräch. Keine Lizenz­entscheidung, keine Rechts­beratung. Jede Aussage hier zitiert eine Primär­quelle (offizielle LICENSE-Datei im Upstream-Repo).
> **Erhebungs­datum:** 2026-05-14
> **Erhoben durch:** Mary (BMAD Analyst), Issue [#10](https://github.com/oliverhees/lokyy/issues/10)

---

## 2.7 Lizenz-Inventar

Vollständiges Tabellen-Inventar in [`docs/licensing-todo.md`](../licensing-todo.md). Dieses Dokument liefert die zugehörigen Faktendetails pro Komponente.

### Methodik

1. Für jede der 6 Stack-Komponenten wurde die offizielle LICENSE-Datei oder das offizielle License-Statement im Upstream-Repo abgerufen.
2. Erfasst wurden: SPDX-Identifier, Quelle-URL (raw LICENSE-Datei), Copyright-Halter, Besonderheiten (Copyleft? Trademark? Dual-License?).
3. Die Spalte "Kommerziell verwertbar (laut SPDX)" gibt ausschliesslich die im SPDX-/OSI-Standardtext der jeweiligen Lizenz dokumentierte Aussage wieder — sie ist **keine rechtliche Bewertung** des Lokyy-Distributions­szenarios.

---

### Komponenten-Faktenblatt

#### 1. Hermes Workspace (Web-Frontend, Fork-Basis)
- **SPDX:** MIT
- **Copyright:** `Copyright (c) 2026 Eric (outsourc-e)`
- **Quelle:** lokale Datei `lokyy-workspace/LICENSE` (entspricht Upstream [`outsourc-e/hermes-workspace`](https://github.com/outsourc-e/hermes-workspace))
- **SPDX-Eigenschaften:** Permissive Lizenz. SPDX-Beschreibung erlaubt kommerzielle Nutzung, Modifikation und Sublizenzierung unter Beibehaltung des Copyright-Vermerks und Lizenztextes.
- **Besonderheiten:** keine Copyleft-Klausel, keine Trademark-Klausel im Lizenztext.

#### 2. Hermes Agent (Multi-Agent Orchestrator)
- **SPDX:** MIT
- **Quelle:** [`NousResearch/hermes-agent/LICENSE`](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE)
- **Evidenz:** README enthält Statement "MIT — see LICENSE"; License-Badge im Repository-Header weist MIT aus.
- **SPDX-Eigenschaften:** Permissive Lizenz wie oben.
- **Besonderheiten:** keine.

#### 3. Cognee (Memory-Layer)
- **SPDX:** Apache-2.0
- **Copyright:** `Copyright 2024 Topoteretes UG` (laut Boilerplate-Notice in LICENSE)
- **Quelle:** [`topoteretes/cognee/LICENSE`](https://github.com/topoteretes/cognee/blob/main/LICENSE)
- **SPDX-Eigenschaften:** Permissive Lizenz. SPDX-Beschreibung erlaubt kommerzielle Nutzung, Modifikation und Distribution unter Bedingungen: Attribution, Beibehaltung des Lizenz­hinweises, **Dokumentation von Änderungen** (Section 4), und expliziter Patent-Grant (Section 3).
- **Besonderheiten:** Patent-Grant-Klausel (Section 3); Trademark-Schutzklausel (Section 6 — Namen "Apache" / Lizenz­geber-Namen sind nicht durch die Lizenz erlaubt).

#### 4. Forgejo (Git-Hosting)
- **SPDX:** GPL-3.0-or-later
- **Quelle:** [`forgejo/forgejo/LICENSE`](https://codeberg.org/forgejo/forgejo/raw/branch/forgejo/LICENSE) — Header verifiziert: "GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007"
- **Lizenzwechsel-Historie:** Forgejo-Versionen **vor v9.0** waren MIT-lizenziert. Ab v9.0 (Juni 2023 dokumentiert) wechselte das Projekt formell auf GPL-3.0-or-later. Quelle: offizielle Forgejo-Dokumentation, referenziert auf forgejo.org.
- **SPDX-Eigenschaften:** **Starkes Copyleft.** SPDX-Beschreibung erlaubt kommerzielle Nutzung, **verlangt** aber, dass abgeleitete Werke unter GPL-3.0-or-later veröffentlicht werden, wenn sie distribuiert werden. Source-Code-Offenlegung verpflichtend bei Distribution.
- **Besonderheiten:** **Copyleft-Pflicht** bei Distribution abgeleiteter Werke. Reine Netzwerk-Nutzung (SaaS) löst GPL-3.0-Pflichten **nicht** automatisch aus — anders als bei AGPL. Faktenstatus für Lokyy-Distributionsszenario: **unklar** ohne juristische Prüfung, weil die genaue Interpretation davon abhängt, ob Forgejo als separates Tool gebündelt oder integriert verteilt wird.

#### 5. Traefik (Reverse Proxy / Ingress)
- **SPDX:** MIT
- **Quelle:** [`traefik/traefik/LICENSE.md`](https://github.com/traefik/traefik/blob/master/LICENSE.md)
- **Evidenz:** License-Badge "MIT" im Repository-Header, LICENSE.md im Root.
- **SPDX-Eigenschaften:** Permissive Lizenz wie oben.
- **Besonderheiten:** Traefik bietet kommerzielle Add-ons (Traefik Enterprise, Traefik Hub) unter separater proprietärer Lizenz — der Core Traefik Proxy ist MIT.

#### 6. Authentik (Identity Provider)
- **SPDX:** MIT (Core/Community Edition) **+ proprietäre EE-Lizenz** (Enterprise Edition) **+ CC BY-SA 4.0** (Website-Inhalte)
- **Copyright (Core):** `Jens Langhammer`
- **Quelle (Core):** [`goauthentik/authentik/LICENSE`](https://github.com/goauthentik/authentik/blob/main/LICENSE)
- **Quelle (EE):** [`goauthentik/authentik/authentik/enterprise/LICENSE`](https://github.com/goauthentik/authentik/blob/main/authentik/enterprise/LICENSE)
- **Quelle (Docs):** [`goauthentik/authentik/website/LICENSE`](https://github.com/goauthentik/authentik/blob/main/website/LICENSE)
- **Lizenztext-Zitat:** "Content outside of the above mentioned directories or restrictions above is available under the 'MIT' license as defined below."
- **SPDX-Eigenschaften (Core):** Permissive Lizenz wie oben.
- **Besonderheiten:** **Dual-License-Modell.** Das `authentik/enterprise/`-Verzeichnis ist **nicht MIT**, sondern unter proprietärer EE-Lizenz. Client-side JavaScript ist als MIT Expat ausgewiesen. Website-Content unter CC BY-SA 4.0. Faktenstatus für Lokyy: Wenn Lokyy nur den Core/Community-Teil bündelt, gilt MIT; sobald Enterprise-Features einbezogen werden, greift die EE-Lizenz.

---

## Faktenzusammenfassung (für Anwaltsgespräch)

- **4 von 6 Komponenten** (Hermes Workspace, Hermes Agent, Traefik, Authentik-Core) sind **MIT-lizenziert** — permissive, gemäss SPDX-Beschreibung kommerziell verwertbar unter Beibehaltung des Copyright-Vermerks.
- **1 Komponente** (Cognee) ist **Apache-2.0** — permissive, gemäss SPDX-Beschreibung kommerziell verwertbar; verlangt zusätzlich Dokumentation von Änderungen und enthält Patent-/Trademark-Klauseln.
- **1 Komponente** (Forgejo) ist **GPL-3.0-or-later** — **starkes Copyleft**, gemäss SPDX-Beschreibung kommerziell nutzbar, aber mit Source-Disclosure-Pflicht bei Distribution abgeleiteter Werke. **Historischer Lizenzwechsel** (MIT → GPL-3.0 ab v9.0) ist zu beachten.
- **1 Komponente** (Authentik) hat **Dual-Licensing**: MIT für Core, proprietär für `authentik/enterprise/`. Der konkrete Scope hängt davon ab, welche Module Lokyy ausrollt.

**Offene Fragen für Anwalt** (nicht von Mary zu klären):
1. Wie wirkt sich Forgejos GPL-3.0-or-later auf die Lokyy-Distribution aus (gebündelt vs. separater Service)?
2. Welche Authentik-Enterprise-Features sind aus dem Lokyy-Stack ausgeschlossen, damit der MIT-Scope nicht verlassen wird?
3. Welche Notice/Attribution-Pflichten muss `NOTICE` im Lokyy-Repo bündeln (Apache-2.0 verlangt explizit NOTICE-Datei-Mitlieferung, sofern Upstream eine hat)?
