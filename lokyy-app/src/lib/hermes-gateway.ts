/**
 * Lokyy ↔ Hermes-Gateway client.
 *
 * Hermes spricht OpenAI-kompatibles API auf :8642.
 * In Dev läuft das via Vite-Proxy unter `/api/hermes/*`,
 * in Production wird die Base-URL über env config gesetzt.
 */

const BASE = '/api/hermes'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatCompletion = {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: string
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export type HermesHealth = { status: string; platform: string }
export type HermesModel = { id: string; object: string; created: number; owned_by: string }
export type HermesModels = { object: 'list'; data: HermesModel[] }

export class HermesGatewayError extends Error {
  constructor(message: string, public readonly status?: number, public readonly cause?: unknown) {
    super(message)
    this.name = 'HermesGatewayError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch (err) {
    throw new HermesGatewayError(
      'Kann Hermes-Gateway nicht erreichen. Läuft `hermes gateway run` auf Port 8642?',
      undefined,
      err,
    )
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new HermesGatewayError(
      `Hermes-Gateway antwortete mit ${response.status}: ${text || response.statusText}`,
      response.status,
    )
  }
  return (await response.json()) as T
}

export function health(): Promise<HermesHealth> {
  return request<HermesHealth>('/health')
}

export function listModels(): Promise<HermesModels> {
  return request<HermesModels>('/v1/models')
}

export type ChatCompletionInput = {
  model?: string
  messages: ChatMessage[]
}

export async function chatCompletion({ model = 'hermes-agent', messages }: ChatCompletionInput) {
  return request<ChatCompletion>('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  })
}

export type StreamCallbacks = {
  onChunk: (delta: string) => void
  onDone: (full: string) => void
  onError: (err: Error) => void
  signal?: AbortSignal
}

export async function streamChatCompletion(
  { model = 'hermes-agent', messages }: ChatCompletionInput,
  cb: StreamCallbacks,
): Promise<void> {
  let full = ''
  try {
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: cb.signal,
    })
    if (!res.ok || !res.body) {
      throw new HermesGatewayError(`Stream failed: ${res.status}`, res.status)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            full += delta
            cb.onChunk(delta)
          }
        } catch {
          // ignore malformed SSE frames (heartbeats etc.)
        }
      }
    }
    cb.onDone(full)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      cb.onDone(full)
      return
    }
    cb.onError(err instanceof Error ? err : new Error(String(err)))
  }
}
