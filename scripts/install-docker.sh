#!/usr/bin/env bash
#
# install-docker.sh — installs Docker Engine + Compose-Plugin on a fresh
# Ubuntu 22.04 / 24.04 server. Idempotent: re-runnable.
#
# Run as a sudo-capable user (NOT root):
#   bash install-docker.sh
#
# What it does:
#   1. Apt-update + minimal CA / curl / gnupg
#   2. Adds Docker's official GPG key + apt repo
#   3. Installs docker-ce, docker-ce-cli, containerd, docker-buildx-plugin,
#      docker-compose-plugin
#   4. Adds the current user to the 'docker' group (so docker runs without
#      sudo after re-login)
#   5. Enables the systemd service
#
# After this script the user should log out + back in once so the new
# group membership takes effect, then run install-lokyy.sh.
#
set -euo pipefail

if [[ "$(id -u)" == "0" ]]; then
  echo "✗ Run as a non-root sudo-capable user, not as root." >&2
  exit 1
fi
if ! sudo -n true 2>/dev/null; then
  echo "✗ Need sudo. Run as a user in /etc/sudoers." >&2
  exit 1
fi

if ! command -v lsb_release >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq lsb-release
fi
DISTRO_ID="$(lsb_release -is 2>/dev/null || echo unknown)"
DISTRO_CODENAME="$(lsb_release -cs 2>/dev/null || echo unknown)"

if [[ "${DISTRO_ID}" != "Ubuntu" && "${DISTRO_ID}" != "Debian" ]]; then
  echo "✗ Unsupported distro: ${DISTRO_ID}. This installer targets Ubuntu/Debian." >&2
  exit 1
fi
echo "→ ${DISTRO_ID} ${DISTRO_CODENAME}"

# Skip everything if a recent docker compose is already there.
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "✓ Docker + Compose-Plugin already present ($(docker --version), $(docker compose version --short))"
  if ! id -nG "${USER}" | grep -qw docker; then
    echo "→ adding ${USER} to docker group"
    sudo usermod -aG docker "${USER}"
    echo "! log out + back in for the new group membership to apply"
  fi
  exit 0
fi

echo "→ apt update + prerequisites"
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg apache2-utils

echo "→ Docker GPG key + apt repo"
sudo install -m 0755 -d /etc/apt/keyrings
DOCKER_GPG_URL="https://download.docker.com/linux/${DISTRO_ID,,}/gpg"
sudo curl -fsSL "${DOCKER_GPG_URL}" -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DISTRO_ID,,} ${DISTRO_CODENAME} stable" |
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

echo "→ apt install docker-ce + compose-plugin"
sudo apt-get update -qq
sudo apt-get install -y -qq \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

echo "→ add ${USER} to docker group"
sudo usermod -aG docker "${USER}"

echo "→ enable systemd service"
sudo systemctl enable --now docker

echo ""
echo "✓ Docker installed: $(docker --version)"
echo "✓ Compose: $(docker compose version --short)"
echo ""
echo "!! IMPORTANT: log out + back in once so 'docker' commands work without sudo."
echo "   Then continue with:  bash scripts/install-lokyy.sh"
