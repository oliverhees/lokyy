#!/usr/bin/env bash
#
# install-lokyy.sh — interaktiver Setup-Wizard für Lokyy KI-OS.
#
# Was das Skript macht:
#   1. Prüft Voraussetzungen (docker, docker-compose-plugin, openssl, htpasswd)
#   2. Generiert sichere Zufallswerte für alle internen Secrets
#   3. Fragt Domain, Email und EINEN LLM-Provider-Key ab
#   4. Schreibt eine vollständige infrastructure/.env.local
#   5. Optional: trägt lokyy.local + Subdomains in /etc/hosts ein
#   6. Optional: trägt Browser-Trust für das selbstsignierte Traefik-Zertifikat
#   7. Baut + startet alle Container und wartet bis sie healthy sind
#   8. Druckt am Ende die URLs und den ersten-Login-Pfad
#
# Sicheres Design:
#   - Existierende Werte in .env.local werden NICHT überschrieben (idempotent)
#   - Secrets werden nur generiert, wenn die Variable fehlt oder leer ist
#   - Schreibrechte 0600 auf .env.local
#   - Keine Secrets im Skript-Output (nur Hinweis "generiert ✓")
#
# Aufruf:
#   ./scripts/install-lokyy.sh
#
set -euo pipefail

# ─── Pfade ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infrastructure"
ENV_FILE="${INFRA_DIR}/.env.local"
ENV_TEMPLATE="${INFRA_DIR}/.env.example"

# ─── Farben ────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_RESET=$'\033[0m'
else
  C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_RESET=""
fi

say() { printf "%s\n" "$*"; }
ok()  { printf "%s✓%s %s\n" "${C_GREEN}" "${C_RESET}" "$*"; }
warn(){ printf "%s!%s %s\n" "${C_YELLOW}" "${C_RESET}" "$*"; }
die() { printf "%s✗%s %s\n" "${C_RED}" "${C_RESET}" "$*" >&2; exit 1; }
hdr() { printf "\n%s── %s ──%s\n" "${C_BOLD}" "$*" "${C_RESET}"; }

# ─── 1. Prerequisites ─────────────────────────────────────────────────────────
hdr "Voraussetzungen prüfen"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Fehlt: '$1'. ${2:-}"
}

need_cmd docker     "Installiere Docker Engine: https://docs.docker.com/engine/install/"
need_cmd openssl    "openssl gehört auf Linux/macOS zur Standardausstattung — fehlt nur in minimalen Containern."

# docker compose v2 plugin OR legacy docker-compose
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  die "Weder 'docker compose' noch 'docker-compose' verfügbar. Brauche das Compose-Plugin."
fi
ok "docker (compose: ${DC[*]})"

# htpasswd (für Traefik-Dashboard-Auth) — optional, wir generieren ohne wenn nicht da
HAS_HTPASSWD=0
if command -v htpasswd >/dev/null 2>&1; then
  HAS_HTPASSWD=1
  ok "htpasswd verfügbar (Traefik-Dashboard wird Passwort-geschützt)"
else
  warn "htpasswd fehlt — installiere apache2-utils (Debian/Ubuntu) oder httpd-tools (RHEL) wenn du das Traefik-Dashboard nutzen willst. Setup läuft trotzdem weiter."
fi

# ─── 2. Bestehende .env.local lesen ───────────────────────────────────────────
hdr "Bestehende Konfiguration lesen"

declare -A ENV_VARS=()
if [[ -f "${ENV_FILE}" ]]; then
  ok "Vorhandene ${ENV_FILE} gefunden — bestehende Werte bleiben erhalten."
  while IFS='=' read -r key val; do
    [[ -z "${key}" || "${key}" =~ ^# ]] && continue
    # Strip optional quotes
    val="${val%\"}"; val="${val#\"}"
    ENV_VARS["${key}"]="${val}"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "${ENV_FILE}" || true)
else
  warn "${ENV_FILE} existiert noch nicht — wird neu angelegt."
fi

# Helper: setze einen Wert, aber NUR wenn er noch nicht da ist (idempotent)
keep_or_set() {
  local key="$1" value="$2"
  if [[ -n "${ENV_VARS[${key}]:-}" ]]; then
    return 1  # already set, keep
  fi
  ENV_VARS["${key}"]="${value}"
  return 0    # newly set
}

# ─── 3. Domain + Email + Hosts ────────────────────────────────────────────────
hdr "Domain / Email"

DOMAIN_DEFAULT="${ENV_VARS[DOMAIN]:-lokyy.local}"
read -r -p "Unter welcher Domain soll Lokyy erreichbar sein? [${DOMAIN_DEFAULT}] " ans_domain || true
DOMAIN="${ans_domain:-${DOMAIN_DEFAULT}}"
ENV_VARS["DOMAIN"]="${DOMAIN}"

EMAIL_DEFAULT="${ENV_VARS[ACME_EMAIL]:-admin@example.com}"
read -r -p "Email für Let's-Encrypt-Zertifikate? [${EMAIL_DEFAULT}] " ans_email || true
ENV_VARS["ACME_EMAIL"]="${ans_email:-${EMAIL_DEFAULT}}"

# Subdomains ableiten
ENV_VARS["TRAEFIK_DASHBOARD_HOST"]="${ENV_VARS[TRAEFIK_DASHBOARD_HOST]:-traefik.${DOMAIN}}"
ENV_VARS["HERMES_DASHBOARD_HOST"]="${ENV_VARS[HERMES_DASHBOARD_HOST]:-hermes.${DOMAIN}}"

ok "DOMAIN=${DOMAIN}"
ok "ACME_EMAIL=${ENV_VARS[ACME_EMAIL]}"

# ─── 4. Internal Secrets generieren ───────────────────────────────────────────
hdr "Sichere Zufallswerte für interne Secrets erzeugen"

gen_hex32() { openssl rand -hex 32; }

for SECRET_KEY in BETTER_AUTH_SECRET LOKYY_SYSTEM_SECRET HERMES_API_KEY LOKYY_AGENT_JWT_SECRET API_SERVER_KEY; do
  if keep_or_set "${SECRET_KEY}" "$(gen_hex32)"; then
    ok "${SECRET_KEY} generiert"
  else
    ok "${SECRET_KEY} bereits gesetzt — bleibt"
  fi
done

# ─── 5. Traefik-Dashboard-Auth (optional) ─────────────────────────────────────
if [[ "${HAS_HTPASSWD}" == "1" ]]; then
  hdr "Traefik-Dashboard-Passwort"
  if [[ -n "${ENV_VARS[TRAEFIK_DASHBOARD_AUTH]:-}" && "${ENV_VARS[TRAEFIK_DASHBOARD_AUTH]}" != *REPLACE_WITH_HTPASSWD_OUTPUT* ]]; then
    ok "TRAEFIK_DASHBOARD_AUTH bereits gesetzt — bleibt"
  else
    say "Lege ein Admin-Passwort für das Traefik-Dashboard fest (frei wählbar)."
    while :; do
      read -r -s -p "  Passwort: " pw1 || true; echo
      read -r -s -p "  Passwort wiederholen: " pw2 || true; echo
      [[ "${pw1}" == "${pw2}" && -n "${pw1}" ]] && break
      warn "Stimmen nicht überein oder leer — nochmal."
    done
    HASH="$(htpasswd -nbB admin "${pw1}" | sed 's/\$/\$\$/g')"
    ENV_VARS["TRAEFIK_DASHBOARD_AUTH"]="${HASH}"
    unset pw1 pw2
    ok "TRAEFIK_DASHBOARD_AUTH gesetzt"
  fi
else
  ENV_VARS["TRAEFIK_DASHBOARD_AUTH"]="${ENV_VARS[TRAEFIK_DASHBOARD_AUTH]:-admin:\$\$2y\$\$05\$\$placeholder}"
fi

# ─── 6. LLM-Provider-Key (mindestens einer nötig) ─────────────────────────────
hdr "LLM-Provider"

say "Hermes braucht mindestens EINEN Provider-Key um Antworten generieren zu können."
say "Du brauchst nur einen — wähle den den du schon hast:"
say "  1) OpenRouter   (https://openrouter.ai — günstig, viele Modelle, free-tier verfügbar)"
say "  2) Anthropic    (https://console.anthropic.com — Claude-Modelle)"
say "  3) OpenAI       (https://platform.openai.com — GPT-Modelle)"
say "  4) überspringen (Hermes startet trotzdem, kann aber nicht antworten bis ein Key gesetzt ist)"

read -r -p "Wahl [1-4, default 1]: " provider_choice || true
provider_choice="${provider_choice:-1}"

case "${provider_choice}" in
  1)
    if [[ -n "${ENV_VARS[OPENROUTER_API_KEY]:-}" ]]; then
      ok "OPENROUTER_API_KEY bereits gesetzt — bleibt"
    else
      read -r -p "  OpenRouter API Key (beginnt mit 'sk-or-'): " key
      ENV_VARS["OPENROUTER_API_KEY"]="${key}"
      ok "OPENROUTER_API_KEY gesetzt"
    fi
    ;;
  2)
    if [[ -n "${ENV_VARS[ANTHROPIC_API_KEY]:-}" ]]; then
      ok "ANTHROPIC_API_KEY bereits gesetzt — bleibt"
    else
      read -r -p "  Anthropic API Key (beginnt mit 'sk-ant-'): " key
      ENV_VARS["ANTHROPIC_API_KEY"]="${key}"
      ok "ANTHROPIC_API_KEY gesetzt"
    fi
    ;;
  3)
    if [[ -n "${ENV_VARS[OPENAI_API_KEY]:-}" ]]; then
      ok "OPENAI_API_KEY bereits gesetzt — bleibt"
    else
      read -r -p "  OpenAI API Key (beginnt mit 'sk-'): " key
      ENV_VARS["OPENAI_API_KEY"]="${key}"
      ok "OPENAI_API_KEY gesetzt"
    fi
    ;;
  4)
    warn "Kein Provider gesetzt. Du musst HERMES_API_KEY später manuell in ${ENV_FILE} eintragen, sonst antwortet kein Agent."
    ;;
  *)
    die "Ungültige Auswahl."
    ;;
esac

# ─── 7. Default-Werte für die restlichen Variablen ────────────────────────────
ENV_VARS["HERMES_BASE_URL"]="${ENV_VARS[HERMES_BASE_URL]:-http://hermes:8642}"
ENV_VARS["LOKYY_MCP_URL"]="${ENV_VARS[LOKYY_MCP_URL]:-http://lokyy-mcp:7878}"
ENV_VARS["LOKYY_CRON_TZ"]="${ENV_VARS[LOKYY_CRON_TZ]:-Europe/Berlin}"
ENV_VARS["HERMES_UID"]="${ENV_VARS[HERMES_UID]:-1000}"
ENV_VARS["HERMES_GID"]="${ENV_VARS[HERMES_GID]:-1000}"
ENV_VARS["LOKYY_VAULT_HOST_PATH"]="${ENV_VARS[LOKYY_VAULT_HOST_PATH]:-}"
ENV_VARS["LOKYY_VAULT_PATH"]="${ENV_VARS[LOKYY_VAULT_PATH]:-}"
ENV_VARS["LOKYY_BRAIN_FORGEJO_URL"]="${ENV_VARS[LOKYY_BRAIN_FORGEJO_URL]:-}"
ENV_VARS["FORGEJO_ADMIN_USER"]="${ENV_VARS[FORGEJO_ADMIN_USER]:-}"
ENV_VARS["SUPADATA_API_KEY"]="${ENV_VARS[SUPADATA_API_KEY]:-}"
ENV_VARS["TRAEFIK_DASHBOARD_AUTH"]="${ENV_VARS[TRAEFIK_DASHBOARD_AUTH]:-admin:\$\$2y\$\$05\$\$placeholder}"

# ─── 8. .env.local schreiben ──────────────────────────────────────────────────
hdr "${ENV_FILE} schreiben"

# Backup, falls existierend
if [[ -f "${ENV_FILE}" ]]; then
  cp "${ENV_FILE}" "${ENV_FILE}.bak"
  ok "Backup: ${ENV_FILE}.bak"
fi

mkdir -p "${INFRA_DIR}"
{
  echo "# Lokyy KI-OS — Local Environment"
  echo "# Generiert von install-lokyy.sh am $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Hand-Edit ist ok; re-run des Skripts behält existierende Werte."
  echo ""
  for k in DOMAIN ACME_EMAIL TRAEFIK_DASHBOARD_HOST HERMES_DASHBOARD_HOST \
           BETTER_AUTH_SECRET LOKYY_SYSTEM_SECRET HERMES_API_KEY \
           LOKYY_AGENT_JWT_SECRET API_SERVER_KEY \
           TRAEFIK_DASHBOARD_AUTH \
           HERMES_BASE_URL LOKYY_MCP_URL LOKYY_CRON_TZ \
           HERMES_UID HERMES_GID \
           ANTHROPIC_API_KEY OPENAI_API_KEY OPENROUTER_API_KEY SUPADATA_API_KEY \
           LOKYY_VAULT_HOST_PATH LOKYY_VAULT_PATH \
           LOKYY_BRAIN_FORGEJO_URL FORGEJO_ADMIN_USER; do
    v="${ENV_VARS[$k]:-}"
    echo "${k}=${v}"
  done
} > "${ENV_FILE}"
chmod 0600 "${ENV_FILE}"
ok "Datei geschrieben, Rechte 0600"

# ─── 9. /etc/hosts Einträge (optional, lokal-dev) ─────────────────────────────
if [[ "${DOMAIN}" == *.local || "${DOMAIN}" == "localhost" ]]; then
  hdr "/etc/hosts-Einträge"
  HOST_LINE="127.0.0.1 ${DOMAIN} ${ENV_VARS[TRAEFIK_DASHBOARD_HOST]} ${ENV_VARS[HERMES_DASHBOARD_HOST]}"
  if grep -qF "${DOMAIN}" /etc/hosts; then
    ok "${DOMAIN} schon in /etc/hosts"
  else
    warn "${DOMAIN} fehlt in /etc/hosts. Vorgeschlagene Zeile:"
    echo "  ${HOST_LINE}"
    read -r -p "Eintrag automatisch via sudo hinzufügen? [y/N] " add || true
    if [[ "${add}" == "y" || "${add}" == "Y" ]]; then
      echo "${HOST_LINE}" | sudo tee -a /etc/hosts >/dev/null
      ok "/etc/hosts updated"
    else
      warn "Übersprungen — du musst die Zeile selbst eintragen, sonst läuft der Browser ins Leere."
    fi
  fi
fi

# ─── 10. docker compose up ────────────────────────────────────────────────────
hdr "Container bauen + starten"

cd "${INFRA_DIR}"
say "→ ${DC[*]} --env-file .env.local build (kann beim ersten Mal 5-10min dauern)…"
"${DC[@]}" --env-file .env.local build 2>&1 | tail -5
ok "Build done"

say "→ ${DC[*]} --env-file .env.local up -d"
# --remove-orphans verhindert dass abgebrochene Builds gehashte
# Geister-Container hinterlassen (z.B. '2c8de1c39bbb_lokyy-os-be').
"${DC[@]}" --env-file .env.local up -d --remove-orphans 2>&1 | tail -10

# ─── 11. Healthcheck-Wait ─────────────────────────────────────────────────────
hdr "Auf healthy warten"

deadline=$(( $(date +%s) + 120 ))
last_status=""
while (( $(date +%s) < deadline )); do
  unhealthy=$("${DC[@]}" --env-file .env.local ps --format json 2>/dev/null | \
    grep -o '"Health":"[^"]*"' | grep -v 'healthy\|""' | wc -l || echo 99)
  if [[ "${unhealthy}" == "0" ]]; then
    ok "Alle Container healthy"
    break
  fi
  status="${unhealthy} container(s) noch nicht healthy …"
  if [[ "${status}" != "${last_status}" ]]; then
    printf "  %s\n" "${status}"
    last_status="${status}"
  fi
  sleep 3
done

# ─── 12. Final summary ────────────────────────────────────────────────────────
hdr "Fertig"

say ""
say "${C_BOLD}Lokyy läuft.${C_RESET}"
say ""
say "  ${C_GREEN}→${C_RESET} App:           https://${DOMAIN}"
say "  ${C_GREEN}→${C_RESET} Traefik-Dash:  https://${ENV_VARS[TRAEFIK_DASHBOARD_HOST]}  (admin / dein Passwort)"
say "  ${C_GREEN}→${C_RESET} Hermes-Dash:   https://${ENV_VARS[HERMES_DASHBOARD_HOST]}  (für Hermes-CLI Setup)"
say ""
say "${C_BOLD}Erster Login:${C_RESET}"
say "  1. Browser öffnen → https://${DOMAIN}"
say "  2. Zertifikat-Warnung akzeptieren (self-signed bei *.local)"
say "  3. Auf der Login-Seite auf 'Registrieren' klicken"
say "  4. Email + Passwort wählen — das ist dein Lokyy-Admin-Account"
say "  5. Dashboard zeigt Sessions/Tasks/Agents/Tools — alle live aus Hermes"
say ""
say "${C_BOLD}Logs anschauen:${C_RESET}"
say "  cd infrastructure && docker compose --env-file .env.local logs -f lokyy-os-be"
say ""
say "${C_BOLD}Stoppen / Neustart:${C_RESET}"
say "  cd infrastructure && docker compose --env-file .env.local stop"
say "  cd infrastructure && docker compose --env-file .env.local up -d"
say ""
say "${C_DIM}Bei Problemen: docs/diary/ + README.md → Troubleshooting${C_RESET}"
