import { NextResponse } from 'next/server'
import { providers } from '@/lib/llm'

export const dynamic = 'force-dynamic'

// Cheap status for the header chip: which LLM providers have a key. No network call, no secrets.
export async function GET() {
  const ids = providers().map((p) => p.id)
  return NextResponse.json({ mode: ids.length ? 'agents' : 'rules', providers: ids })
}
