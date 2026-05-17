FROM oven/bun:1-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json bun.lockb* ./
RUN bun install --production

COPY src ./src

ENV PORT=7878
EXPOSE 7878

# Healthcheck against /health (public, no auth) — same pattern as lokyy-os-be.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:7878/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["bun", "src/server.ts"]
