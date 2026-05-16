# lokyy-os-be — Phase-1 scaffold
# Bun + Hono. Single-stage; runtime is the same as the build environment.

FROM oven/bun:1
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
EXPOSE 80
ENV PORT=80
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD bun -e "fetch('http://localhost/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["bun", "src/index.ts"]
