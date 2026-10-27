'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const CASE = [
  { href: '/impact', label: 'Impact and ROI', sub: 'Business case, pilot, risks' },
  { href: '/architecture', label: 'Architecture', sub: 'Agents, tools, guardrails' },
  { href: '/evidence', label: 'Evidence', sub: 'Data sources and limits' },
  { href: '/alternatives', label: 'Alternatives', sub: 'Competitors and options' },
]

export default function Nav() {
  const path = usePathname() || '/'
  const [st, setSt] = useState<{ mode: string; providers: string[] } | null>(null)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setSt).catch(() => setSt(null))
  }, [])
  useEffect(() => setMenu(false), [path])
  const live = st?.mode === 'agents'
  const inCase = CASE.some((c) => c.href === path)
  return (
    <header className="nav">
      <Link href="/" className="brand" aria-label="ReliaDesk home">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <g fill="#7fd6d6"><circle cx="5" cy="7" r="2" /><circle cx="9" cy="13" r="2" /><circle cx="4" cy="19" r="2" /><circle cx="9" cy="25" r="2" /></g>
          <circle cx="7" cy="16" r="1.6" fill="#ff6b6b" />
          <path d="M14 5 L14 27 L28 16 Z" fill="#0FA3A3" />
        </svg>
        <span>ReliaDesk</span>
      </Link>
      <span className="plant">Demo plant · 3 lines · 40 assets</span>
      <nav className="navlinks" aria-label="Main">
        <Link href="/" className={path === '/' ? 'on' : ''}>Alerts</Link>
        <Link href="/eval" className={path === '/eval' ? 'on' : ''}>Performance</Link>
        <div className="menuwrap">
          <button className={inCase ? 'on' : ''} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>Case file ▾</button>
          {menu && (
            <div className="menu" role="menu">
              {CASE.map((c) => (
                <Link key={c.href} href={c.href} role="menuitem"><b>{c.label}</b><span>{c.sub}</span></Link>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="status" title={live ? 'LLM agents enabled. Open /api/llm-check to test them.' : 'No LLM key set: agents run on the rule-based path'}>
        <span className={`dot ${st ? (live ? 'live' : 'rules') : ''}`} />
        {st ? (live ? 'AI agents on' : 'Rules mode') : '...'}
      </div>
      <span className="avatar" title="Maintenance supervisor (demo user)">SV</span>
    </header>
  )
}
