/**
 * lokyy-mcp — Lokyy System Bus (Phase-4, ADR-008).
 *
 * Exposes the MCP protocol over HTTP+SSE on the lokyy-net Docker network.
 * Binds only to that network — never reachable from the public internet,
 * never via Traefik.
 *
 * Tool surface for this slice (ISC-82–84): empty `list_tools` response.
 * Real System Skills land in ISC-86+ — DashboardBuilder first.
 *
 * Routes:
 *   GET  /health              public liveness ping (no auth, for Docker healthcheck)
 *   GET  /mcp                 SSE transport (auth required)
 *   POST /mcp/messages        SSE response channel (auth required)
 */
import { Hono } from "hono";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { randomUUID } from "node:crypto";
import { requireBearer, getPrincipal, type Principal } from "./auth.ts";
import { admin } from "./admin.ts";
import { listToolsFor, invokeTool } from "./tool-registry.ts";

const PORT = Number(process.env.PORT ?? 7878);
const SERVICE_NAME = "lokyy-mcp";
const SERVICE_VERSION = "0.1.0";

function buildMcpServer(principal: Principal): Server {
  const server = new Server(
    { name: SERVICE_NAME, version: SERVICE_VERSION },
    { capabilities: { tools: {} } }
  );

  // ISC-83 + ISC-87: list_tools returns the registry filtered by the
  // caller's privilege — Capability principals only see tools they can
  // actually invoke, so Hermes' tool picker can't be tricked into
  // calling something it'll just get rejected on.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listToolsFor(principal),
  }));

  // call_tool — delegate to the shared registry; format result/error as
  // MCP content blocks.
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const result = await invokeTool(
        req.params.name,
        req.params.arguments ?? {},
        principal
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: (err as Error).message,
          },
        ],
      };
    }
  });

  return server;
}

/**
 * Custom MCP transport that emits Server-Sent-Events through a Bun/Web
 * ReadableStream controller, and accepts client → server JSON-RPC over
 * a separate POST endpoint keyed by sessionId.
 *
 * The SDK ships its own SSE transport but it assumes Node/Express
 * (req, res) — Bun + Hono use the Web Response API instead, so we
 * implement the Transport interface directly. This is small enough
 * to be more transparent than monkey-patching the SDK class.
 */
class SseTransport implements Transport {
  readonly sessionId: string;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private encoder = new TextEncoder();
  private closed = false;

  constructor(private controller: ReadableStreamDefaultController<Uint8Array>) {
    this.sessionId = randomUUID();
  }

  async start(): Promise<void> {
    // Initial "endpoint" event tells the MCP client where to POST.
    this.write(
      `event: endpoint\ndata: /mcp/messages?sessionId=${this.sessionId}\n\n`
    );
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller.close();
    } catch {
      // already closed
    }
    this.onclose?.();
  }

  /** Called from the POST handler with a parsed JSON-RPC message. */
  deliver(msg: JSONRPCMessage) {
    this.onmessage?.(msg);
  }

  private write(chunk: string) {
    if (this.closed) return;
    try {
      this.controller.enqueue(this.encoder.encode(chunk));
    } catch (err) {
      this.onerror?.(err as Error);
    }
  }
}

// In-memory map of active SSE transports keyed by sessionId.
const transports = new Map<string, SseTransport>();

const app = new Hono();

app.get("/health", (c) =>
  c.json({ ok: true, service: SERVICE_NAME, version: SERVICE_VERSION })
);

// Everything under /mcp is bearer-gated.
const mcp = new Hono();
mcp.use("*", requireBearer);

mcp.get("/", (c) => {
  const principal = getPrincipal(c);
  console.log(`[lokyy-mcp] SSE connect — principal=${principal?.kind}`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const transport = new SseTransport(controller);
      transports.set(transport.sessionId, transport);

      transport.onclose = () => {
        transports.delete(transport.sessionId);
        console.log(`[lokyy-mcp] SSE close — session=${transport.sessionId}`);
      };
      transport.onerror = (err) => {
        console.error(
          `[lokyy-mcp] SSE error — session=${transport.sessionId}:`,
          err.message
        );
      };

      // Per-session MCP-Server bound to the caller's principal so tool
      // listing + dispatch can enforce privilege without re-reading the
      // request header on every JSON-RPC call.
      const server = buildMcpServer(principal!);
      try {
        await server.connect(transport);
      } catch (err) {
        console.error("[lokyy-mcp] server.connect failed:", err);
        await transport.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

mcp.post("/messages", async (c) => {
  const sessionId = c.req.query("sessionId") ?? "";
  const transport = transports.get(sessionId);
  if (!transport) return c.json({ error: "unknown_session" }, 404);
  const body = (await c.req.json()) as JSONRPCMessage;
  transport.deliver(body);
  return c.body(null, 202);
});

app.route("/mcp", mcp);

// Admin surface — Capability-Token management. System bearer only.
app.route("/admin", admin);

console.log(
  `[lokyy-mcp] listening on :${PORT} — service=${SERVICE_NAME} v${SERVICE_VERSION}`
);

export default {
  port: PORT,
  fetch: app.fetch,
};
