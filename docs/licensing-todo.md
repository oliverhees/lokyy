# Licensing TODO — Etappe 1

**Zweck:** Faktensammlung für Olivers Anwaltsgespräch. Keine Lizenzentscheidung, nur Inventarisierung.

**Status:** Befüllt am 2026-05-14 durch Mary (BMAD Analyst) im Rahmen von Issue [#10](https://github.com/oliverhees/lokyy/issues/10). Detail­fakten und Methodik in [`docs/recon/licenses.md`](recon/licenses.md).

**Wichtig:** Die Spalte "Kommerziell verwertbar (laut SPDX)" gibt ausschliesslich die im SPDX-Standardtext der jeweiligen Lizenz dokumentierte Aussage wieder — sie ist **keine rechtliche Bewertung** des Lokyy-Distributions­szenarios. Die Lizenz-Interpretation übernimmt Olivers Anwalt.

---

## Stack-Komponenten Lizenz-Inventar

| Komponente | Lizenztyp | Kommerziell verwertbar (laut SPDX) | Quelle |
|------------|-----------|------------------------------------|--------|
| Hermes Workspace | MIT | Ja (MIT erlaubt kommerzielle Nutzung; verlangt Beibehaltung Copyright-Vermerk) | lokal `lokyy-workspace/LICENSE` (Copyright (c) 2026 Eric / outsourc-e) |
| Hermes Agent | MIT | Ja (MIT erlaubt kommerzielle Nutzung; verlangt Beibehaltung Copyright-Vermerk) | [`NousResearch/hermes-agent/LICENSE`](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE) |
| Cognee | Apache-2.0 | Ja (Apache-2.0 erlaubt kommerzielle Nutzung; verlangt Attribution, Doku der Änderungen, enthält Patent-Grant und Trademark-Klausel) | [`topoteretes/cognee/LICENSE`](https://github.com/topoteretes/cognee/blob/main/LICENSE) (Copyright 2024 Topoteretes UG) |
| Forgejo | GPL-3.0-or-later | Ja (GPL-3.0 erlaubt kommerzielle Nutzung), **aber starkes Copyleft**: Distribution abgeleiteter Werke verpflichtet zur Source-Disclosure und Weitergabe unter GPL-3.0-or-later. Lizenzwechsel ab v9.0 (vorher MIT) | [`forgejo/forgejo/LICENSE`](https://codeberg.org/forgejo/forgejo/raw/branch/forgejo/LICENSE) |
| Traefik | MIT | Ja (MIT erlaubt kommerzielle Nutzung; verlangt Beibehaltung Copyright-Vermerk). Hinweis: Traefik Enterprise / Hub sind separat proprietär | [`traefik/traefik/LICENSE.md`](https://github.com/traefik/traefik/blob/master/LICENSE.md) |
| Authentik | MIT (Core) + proprietäre EE-Lizenz (Enterprise) + CC BY-SA 4.0 (Website) | Core: Ja (MIT). Enterprise-Verzeichnis: **unklar** — proprietäre Lizenz, kommerzielle Nutzung nur nach EE-Lizenzbedingungen | Core: [`goauthentik/authentik/LICENSE`](https://github.com/goauthentik/authentik/blob/main/LICENSE) (Copyright Jens Langhammer) · EE: [`authentik/enterprise/LICENSE`](https://github.com/goauthentik/authentik/blob/main/authentik/enterprise/LICENSE) |

---

## Kontext für Anwaltsgespräch

Drei Fakten verdienen Hervorhebung:

1. **Forgejo = einziges Copyleft-Element im Stack** (GPL-3.0-or-later seit v9.0). Vor v9.0 war Forgejo MIT — Lizenz­wechsel muss bei Distributions­fragen mitgedacht werden.
2. **Authentik hat ein Dual-License-Modell** — MIT-Core ist sauber, `authentik/enterprise/`-Pfad nicht. Welche Enterprise-Features Lokyy ausschliesst, ist eine Produktentscheidung mit Lizenzfolgen.
3. **Apache-2.0 (Cognee) verlangt eine NOTICE-Mitlieferung**, sofern Upstream eine NOTICE-Datei führt — separater Compliance-Schritt gegenüber MIT.

Vollständige Faktenlage, Quellenzitate und offene Fragen: [`docs/recon/licenses.md`](recon/licenses.md).
