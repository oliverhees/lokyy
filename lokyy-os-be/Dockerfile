# lokyy-os-be — Phase-1b auth
# Bun + Hono + Better-Auth + better-sqlite3 (native module, built at install).

FROM oven/bun:1
WORKDIR /app

# No native modules — bun:sqlite is built into the Bun runtime.
COPY package.json ./
RUN bun install

COPY . .

# Ensure the DB directory exists at build time so the volume mount is happy.
RUN mkdir -p /app/data

EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Schema is applied idempotently inside src/auth.ts on import — no external
# migrator needed. (Better-Auth's CLI was unreliable in Bun's non-TTY context.)
CMD ["bun", "src/index.ts"]
