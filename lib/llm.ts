// One OpenAI-compatible client over several FREE providers, tried in order.
// Groq, Google Gemini (AI Studio), OpenRouter free models and xAI Grok all speak the same
// /chat/completions protocol with tool calling, so a failure or rate limit on one provider
// falls through to the next, and finally to the rule-based path in the caller.

export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface Msg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}
export interface ToolDef { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface Provider { id: string; base: string; key: string; models: string[] }
export interface ChatResult {
  provider: string
  model: string
  message: Msg
  usage: { prompt: number; completion: number }
  ms: number
  failed: string[] // providers tried before this one, with the reason (no secrets)
}

const env = (k: string) => (process.env[k] || '').trim()
const list = (k: string, fallback: string) => (env(k) || fallback).split(',').map((x) => x.trim()).filter(Boolean)

// Free-tier model catalogs change often. Each provider gets an ordered list; a model that returns
// "not found" or a server error is skipped, and remembered as dead for a few minutes.
// Override with GROQ_MODEL, GEMINI_MODEL, OPENROUTER_MODEL or XAI_MODEL (comma separated).
export function providers(): Provider[] {
  const defs: Record<string, () => Provider | null> = {
    groq: () => env('GROQ_API_KEY') ? { id: 'groq', base: 'https://api.groq.com/openai/v1', key: env('GROQ_API_KEY'), models: list('GROQ_MODEL', 'openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.3-70b-versatile') } : null,
    gemini: () => env('GEMINI_API_KEY') ? { id: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', key: env('GEMINI_API_KEY'), models: list('GEMINI_MODEL', 'gemini-flash-lite-latest,gemini-flash-latest') } : null,
    openrouter: () => env('OPENROUTER_API_KEY') ? { id: 'openrouter', base: 'https://openrouter.ai/api/v1', key: env('OPENROUTER_API_KEY'), models: list('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-20b:free') } : null,
    xai: () => env('XAI_API_KEY') ? { id: 'xai', base: 'https://api.x.ai/v1', key: env('XAI_API_KEY'), models: list('XAI_MODEL', 'grok-4.3') } : null,
  }
  return (env('LLM_CHAIN') || 'groq,gemini,openrouter,xai')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => defs[id]?.() || null)
    .filter((x): x is Provider => !!x)
}

const dead = new Map<string, number>() // "provider/model" -> time until which it is skipped
const DEAD_MS = 10 * 60 * 1000
export function resetModelCache() { dead.clear() }

// Gemini's OpenAI-compatible endpoint expects the function name on tool-result messages.
function forProvider(p: Provider, messages: Msg[]): unknown[] {
  if (p.id !== 'gemini') return messages
  const names = new Map<string, string>()
  for (const m of messages) for (const c of m.tool_calls || []) names.set(c.id, c.function.name)
  return messages.map((m) => (m.role === 'tool' && m.tool_call_id ? { ...m, name: names.get(m.tool_call_id) || 'tool' } : m))
}

export class LLMUnavailable extends Error {
  failed: string[]
  constructor(failed: string[]) {
    super(failed.length ? 'All LLM providers failed' : 'No LLM provider configured')
    this.failed = failed
  }
}

type Attempt = ChatResult | 'notfound' | 'next' | 'stop'

async function attempt(p: Provider, model: string, opts: { messages: Msg[]; tools?: ToolDef[]; maxTokens?: number; timeoutMs?: number }, failed: string[]): Promise<Attempt> {
  const label = `${p.id}/${model}`
  if ((dead.get(label) || 0) > Date.now()) return 'notfound'
  const t0 = Date.now()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, opts.timeoutMs ?? 15000))
  try {
    const gptOss = model.startsWith('openai/gpt-oss')
    const body: Record<string, unknown> = { model, messages: forProvider(p, opts.messages), temperature: 0.1, max_tokens: (opts.maxTokens ?? 500) + (gptOss ? 600 : 0) }
    if (gptOss || (p.id === 'gemini' && !model.includes('lite'))) body.reasoning_effort = 'low' // keeps hidden thinking from slowing or eating the answer
    if (opts.tools?.length) { body.tools = opts.tools; body.tool_choice = 'auto' }
    const resp = await fetch(`${p.base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    if (!resp.ok) {
      failed.push(`${label}: HTTP ${resp.status}`)
      if (resp.status === 401 || resp.status === 403 || resp.status === 429) return 'stop' // key or quota problem, next provider
      if (resp.status === 404 || resp.status === 400) { dead.set(label, Date.now() + DEAD_MS); return 'notfound' }
      return 'next'
    }
    const data = await resp.json()
    const m = data?.choices?.[0]?.message
    if (!m) { failed.push(`${label}: empty response`); return 'next' }
    return {
      provider: p.id,
      model,
      message: { role: 'assistant', content: m.content ?? null, tool_calls: Array.isArray(m.tool_calls) && m.tool_calls.length ? m.tool_calls : undefined },
      usage: { prompt: data?.usage?.prompt_tokens ?? 0, completion: data?.usage?.completion_tokens ?? 0 },
      ms: Date.now() - t0,
      failed,
    }
  } catch (e) {
    failed.push(`${label}: ${(e as Error).name === 'AbortError' ? 'timeout' : 'network error'}`)
    return 'stop' // timeouts and network errors are not model specific, next provider
  } finally {
    clearTimeout(timer)
  }
}

// Ask the provider which models it really offers, drop speech, embedding and guard models, and rank the rest.
const SKIP = /whisper|tts|guard|embed|orpheus|safeguard|compound|moderation|image|vision-preview/i
const PREFER = [/gpt-oss-120b/, /gpt-oss-20b/, /llama-3\.3-70b/, /llama-4/, /qwen/, /kimi/, /llama/]
const found = new Map<string, { ids: string[]; until: number }>()
export async function listModels(p: Provider): Promise<string[]> {
  const hit = found.get(p.id)
  if (hit && hit.until > Date.now()) return hit.ids
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 6000)
    const resp = await fetch(`${p.base}/models`, { headers: { authorization: `Bearer ${p.key}` }, signal: ctl.signal })
    clearTimeout(timer)
    if (!resp.ok) return []
    const data = await resp.json()
    const all: string[] = (Array.isArray(data?.data) ? data.data : []).map((m: { id?: string }) => String(m.id || '').replace(/^models\//, '')).filter(Boolean)
    const rank = (id: string) => { const i = PREFER.findIndex((r) => r.test(id)); return i < 0 ? 99 : i }
    const ids = all.filter((id) => !SKIP.test(id)).sort((a, b) => rank(a) - rank(b))
    found.set(p.id, { ids, until: Date.now() + DEAD_MS })
    return ids
  } catch {
    return []
  }
}

export async function chat(opts: { messages: Msg[]; tools?: ToolDef[]; maxTokens?: number; timeoutMs?: number }): Promise<ChatResult> {
  const failed: string[] = []
  for (const p of providers()) {
    let allNotFound = true
    let stop = false
    for (const model of p.models) {
      const r = await attempt(p, model, opts, failed)
      if (typeof r === 'object') return r
      if (r === 'stop') { stop = true; break }
      if (r !== 'notfound') allNotFound = false
    }
    // Every configured model is unavailable: ask the provider what it offers now and use that.
    if (!stop && allNotFound && p.id !== 'gemini') {
      const ids = (await listModels(p)).filter((id) => !p.models.includes(id)).slice(0, 3)
      for (const model of ids) {
        const r = await attempt(p, model, opts, failed)
        if (typeof r === 'object') return r
        if (r === 'stop') break
      }
    }
  }
  throw new LLMUnavailable(failed)
}

// Used by /api/llm-check: what each configured provider says, without exposing any key.
export async function checkProviders() {
  const out = []
  for (const p of providers()) {
    const listed = await listModels(p)
    const t0 = Date.now()
    const failed: string[] = []
    let result: { model: string; ms: number; reply: string } | { error: string[] }
    const candidates = [...p.models, ...listed.filter((m) => !p.models.includes(m)).slice(0, 2)]
    result = { error: [] }
    for (const model of candidates) {
      const r = await attempt(p, model, { messages: [{ role: 'user', content: 'Reply with the single word ok.' }], maxTokens: 30, timeoutMs: 12000 }, failed)
      if (typeof r === 'object') { result = { model, ms: Date.now() - t0, reply: String(r.message.content || '').slice(0, 40) }; break }
      if (r === 'stop') break
    }
    if ('error' in result) result = { error: failed }
    out.push({ provider: p.id, configuredModels: p.models, liveModelsSeen: listed.slice(0, 12), test: result })
  }
  return out
}
