# lokyy-app — Phase-1c Etappe-2 Frontend (TanStack Router + shadcn + base-ui)
# Multi-stage: Node 22 + corepack/pnpm to build the SPA, nginx:alpine to serve.
# /api/* is proxied internally to lokyy-os-be via nginx.conf (see file).
# Dev-only vite middleware in src/server/* is irrelevant for the production build.

FROM node:22-alpine AS builder
WORKDIR /app
# python3 + make + g++ so better-sqlite3 (used by lokyy-app's dev-server middleware
# in src/server/auth.ts) can build its native binding. The static SPA build itself
# doesn't bundle better-sqlite3, but pnpm install fails without the toolchain.
RUN apk add --no-cache python3 make g++ \
 && corepack enable \
 && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
# pnpm 9.x doesn't have the strict-build-script gate that pnpm 10+ added.
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD wget --spider -q http://127.0.0.1/ || exit 1
