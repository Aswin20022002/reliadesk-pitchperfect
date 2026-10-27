import { NextResponse } from 'next/server'
import { checkProviders, providers } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

// Diagnostic page: shows which free LLM providers are configured and whether a tiny test call works.
// Never returns keys. Limited so a public URL cannot be used to burn the free quota.
let last = 0
export async function GET() {
  if (Date.now() - last < 10000) return NextResponse.json({ error: 'Wait 10 seconds between checks.' }, { status: 429 })
  last = Date.now()
  if (!providers().length) return NextResponse.json({ configured: [], note: 'No LLM key is set. Add GROQ_API_KEY and/or GEMINI_API_KEY in Vercel and redeploy.' })
  return NextResponse.json({ configured: providers().map((p) => p.id), providers: await checkProviders() })
}
