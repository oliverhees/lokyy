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
