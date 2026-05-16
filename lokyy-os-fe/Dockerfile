# lokyy-os-fe — Phase-1 scaffold
# Multi-stage: Bun to build the Vite app, nginx:alpine to serve the static dist/.

FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget --spider -q http://127.0.0.1/ || exit 1
