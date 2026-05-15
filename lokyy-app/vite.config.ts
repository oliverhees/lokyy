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
