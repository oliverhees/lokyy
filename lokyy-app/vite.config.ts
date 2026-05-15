import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

function betterAuthDevPlugin(): Plugin {
  return {
    name: 'lokyy-better-auth',
    configureServer(server) {
      server.middlewares.use('/api/lokyy/agents', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = req.url ?? ''
          const toggleSkillMatch = url.match(/^\/([^/?#]+)\/skills\/([^/?#]+)\/toggle$/)
          const toggleMcpMatch = url.match(/^\/([^/?#]+)\/mcps\/([^/?#]+)\/toggle$/)
          if ((toggleSkillMatch || toggleMcpMatch) && req.method === 'POST') {
            const overrides = (await server.ssrLoadModule('/src/server/agent-overrides.ts')) as {
              toggleSkill: (a: string, id: string) => { nowEnabled: boolean }
              toggleMcp: (a: string, id: string) => { nowEnabled: boolean }
            }
            const m = (toggleSkillMatch ?? toggleMcpMatch)!
            const agentId = decodeURIComponent(m[1])
            const targetId = decodeURIComponent(m[2])
            const result = toggleSkillMatch
              ? overrides.toggleSkill(agentId, targetId)
              : overrides.toggleMcp(agentId, targetId)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(result))
            return
          }
          const skillsMatch = url.match(/^\/([^/?#]+)\/skills/)
          if (skillsMatch) {
            const agentId = decodeURIComponent(skillsMatch[1])
            const mod = (await server.ssrLoadModule('/src/server/hermes-skills.ts')) as {
              listSkillsForAgent: (id: string) => unknown[]
            }
            const skills = mod.listSkillsForAgent(agentId)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ skills }))
            return
          }
          const mcpsMatch = url.match(/^\/([^/?#]+)\/mcps/)
          if (mcpsMatch) {
            const agentId = decodeURIComponent(mcpsMatch[1])
            const mod = (await server.ssrLoadModule('/src/server/hermes-mcps.ts')) as {
              listMcpsForAgent: (id: string) => unknown[]
              listMcpPresets: () => unknown[]
            }
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ mcps: mod.listMcpsForAgent(agentId), presets: mod.listMcpPresets() }))
            return
          }
          const mod = (await server.ssrLoadModule('/src/server/hermes-profiles.ts')) as {
            listAgents: () => unknown
          }
          const agents = mod.listAgents()
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ agents }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      server.middlewares.use('/api/lokyy/settings', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/settings-store.ts')) as {
            readSettings: () => unknown
            writeSettings: (patch: unknown) => unknown
          }
          const method = req.method ?? 'GET'
          res.setHeader('content-type', 'application/json')
          if (method === 'GET') {
            res.end(JSON.stringify({ settings: mod.readSettings() }))
            return
          }
          if (method === 'PATCH') {
            const bodyText = await new Promise<string>((resolve) => {
              const chunks: Buffer[] = []
              req.on('data', (c) => chunks.push(c))
              req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
            })
            const patch = bodyText ? JSON.parse(bodyText) : {}
            res.end(JSON.stringify({ settings: mod.writeSettings(patch) }))
            return
          }
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'method not allowed' }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      server.middlewares.use('/api/lokyy/integrations', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/integrations-registry.ts')) as {
            listIntegrations: () => unknown[]
            connectIntegration: (id: string) => { ok: boolean }
            disconnectIntegration: (id: string) => { ok: boolean }
          }
          const url = req.url ?? ''
          const method = req.method ?? 'GET'
          if (method === 'GET' && url === '/') {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ integrations: mod.listIntegrations() }))
            return
          }
          const connectMatch = url.match(/^\/([^/?#]+)\/(connect|disconnect)$/)
          if (connectMatch && method === 'POST') {
            const id = decodeURIComponent(connectMatch[1])
            const action = connectMatch[2]
            const result = action === 'connect' ? mod.connectIntegration(id) : mod.disconnectIntegration(id)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(result))
            return
          }
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'not found' }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      server.middlewares.use('/api/lokyy/vault', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/vault.ts')) as {
            vaultConfigured: () => boolean
            vaultRoot: () => string | null
            listVaultDir: (rel: string) => unknown[]
            readVaultFile: (rel: string) => string
          }
          const url = new URL(`http://x${req.url ?? ''}`)
          const action = url.searchParams.get('action') ?? 'list'
          const relPath = url.searchParams.get('path') ?? ''
          res.setHeader('content-type', 'application/json')
          if (!mod.vaultConfigured()) {
            res.end(JSON.stringify({ configured: false, root: null, entries: [], content: null }))
            return
          }
          if (action === 'read') {
            const content = mod.readVaultFile(relPath)
            res.end(JSON.stringify({ configured: true, root: mod.vaultRoot(), content, path: relPath }))
            return
          }
          const entries = mod.listVaultDir(relPath)
          res.end(JSON.stringify({ configured: true, root: mod.vaultRoot(), entries, path: relPath }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      async function jsonCrudHandler(
        req: IncomingMessage,
        res: ServerResponse,
        modPath: string,
        listFn: string,
        createFn: string,
        updateFn: string,
        deleteFn: string,
        pluralKey: string,
        singleKey: string,
      ) {
        try {
          const mod = (await server.ssrLoadModule(modPath)) as Record<string, unknown>
          const list = mod[listFn] as () => unknown[]
          const create = mod[createFn] as (input: unknown) => unknown
          const update = mod[updateFn] as (id: string, patch: unknown) => unknown
          const del = mod[deleteFn] as (id: string) => boolean
          const url = req.url ?? ''
          const idMatch = url.match(/^\/([^/?#]+)$/)
          const method = req.method ?? 'GET'

          if (method === 'GET' && url === '/') {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ [pluralKey]: list() }))
            return
          }
          const bodyText = await new Promise<string>((resolve) => {
            const chunks: Buffer[] = []
            req.on('data', (c) => chunks.push(c))
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          })
          const json = bodyText ? JSON.parse(bodyText) : {}

          if (method === 'POST' && url === '/') {
            const created = create(json)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ [singleKey]: created }))
            return
          }
          if (idMatch && method === 'PATCH') {
            const updated = update(decodeURIComponent(idMatch[1]), json)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ [singleKey]: updated }))
            return
          }
          if (idMatch && method === 'DELETE') {
            const ok = del(decodeURIComponent(idMatch[1]))
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok }))
            return
          }
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'not found' }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      }

      server.middlewares.use('/api/lokyy/workflows', (req: IncomingMessage, res: ServerResponse) =>
        jsonCrudHandler(req, res, '/src/server/workflows-store.ts', 'listWorkflows', 'createWorkflow', 'updateWorkflow', 'deleteWorkflow', 'workflows', 'workflow'),
      )

      server.middlewares.use('/api/lokyy/teams', (req: IncomingMessage, res: ServerResponse) =>
        jsonCrudHandler(req, res, '/src/server/teams-store.ts', 'listTeams', 'createTeam', 'updateTeam', 'deleteTeam', 'teams', 'team'),
      )

      server.middlewares.use('/api/lokyy/prompts', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/prompts-store.ts')) as {
            listPrompts: () => unknown[]
            createPrompt: (input: { title: string; body: string; tags?: string[] }) => unknown
            updatePrompt: (id: string, patch: unknown) => unknown
            deletePrompt: (id: string) => boolean
          }
          const url = req.url ?? ''
          const idMatch = url.match(/^\/([^/?#]+)$/)
          const method = req.method ?? 'GET'

          if (method === 'GET' && url === '/') {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ prompts: mod.listPrompts() }))
            return
          }

          const bodyText = await new Promise<string>((resolve) => {
            const chunks: Buffer[] = []
            req.on('data', (c) => chunks.push(c))
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          })
          const json = bodyText ? JSON.parse(bodyText) : {}

          if (method === 'POST' && url === '/') {
            const created = mod.createPrompt(json)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ prompt: created }))
            return
          }
          if (idMatch && method === 'PATCH') {
            const updated = mod.updatePrompt(decodeURIComponent(idMatch[1]), json)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ prompt: updated }))
            return
          }
          if (idMatch && method === 'DELETE') {
            const ok = mod.deletePrompt(decodeURIComponent(idMatch[1]))
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok }))
            return
          }
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'not found' }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      server.middlewares.use('/api/lokyy/jobs', async (_req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/hermes-jobs.ts')) as {
            listJobs: () => unknown[]
          }
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ jobs: mod.listJobs() }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ jobs: [], error: String(err) }))
        }
      })

      server.middlewares.use('/api/lokyy/sessions', async (_req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/hermes-sessions.ts')) as {
            listSessions: () => unknown[]
          }
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ sessions: mod.listSessions() }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ sessions: [], error: String(err) }))
        }
      })

      server.middlewares.use('/api/lokyy/owner-exists', async (_req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = (await server.ssrLoadModule('/src/server/auth.ts')) as { ownerExists: () => boolean }
          const exists = mod.ownerExists()
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ownerExists: exists }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ownerExists: false, error: String(err) }))
        }
      })

      server.middlewares.use('/api/auth', async (req: IncomingMessage, res: ServerResponse) => {
        const { auth } = await server.ssrLoadModule('/src/server/auth.ts')
        const url = `http://${req.headers.host}/api/auth${req.url ?? ''}`
        const body = await new Promise<Buffer>((resolve) => {
          const chunks: Buffer[] = []
          req.on('data', (c) => chunks.push(c))
          req.on('end', () => resolve(Buffer.concat(chunks)))
        })
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers.set(k, v)
          else if (Array.isArray(v)) headers.set(k, v.join(', '))
        }
        const request = new Request(url, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        })
        const response: Response = await auth.handler(request)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        const responseBody = await response.arrayBuffer()
        res.end(Buffer.from(responseBody))
      })
    },
  }
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
    betterAuthDevPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3100,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api/hermes': {
        target: 'http://127.0.0.1:8642',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/hermes/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Hermes-Gateway lehnt cross-origin Requests mit 403 ab.
            // Da das Browser-Origin im Dev (http://127.0.0.1:3100) ein anderes ist
            // als das Gateway (http://127.0.0.1:8642), strippen wir den Origin-Header
            // bei Proxy-Forwarding — wir agieren als vertrauenswürdiger Server-Side-Proxy.
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
    },
  },
  preview: {
    port: 3100,
    strictPort: true,
  },
})
