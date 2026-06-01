# lokyy-os-be — Phase-1b auth
# Bun + Hono + Better-Auth + better-sqlite3 (native module, built at install).

FROM oven/bun:1
WORKDIR /app

# Second Brain (Phase-3) needs `git` for clone/init/push and `openssh-client`
# for the auto-generated ed25519 keypair used as the remote auth method.
# oven/bun:1 is debian-slim — apt-get is available.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# No native modules — bun:sqlite is built into the Bun runtime.
COPY package.json ./
RUN bun install

COPY . .

# Ensure the DB + vault dirs exist at build time so volume mounts are happy.
# /app/vault is the Second-Brain mount target (named volume `lokyy-vault-data`
# in docker-compose.yml). /root/.ssh holds the auto-generated keypair.
RUN mkdir -p /app/data /app/vault /root/.ssh \
 && chmod 700 /root/.ssh

EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Schema is applied idempotently inside src/auth.ts on import — no external
# migrator needed. (Better-Auth's CLI was unreliable in Bun's non-TTY context.)
CMD ["bun", "src/index.ts"]
