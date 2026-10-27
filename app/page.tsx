'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Result, Verdict, Outcomes, OutcomeLabel } from '@/lib/agents'
import { fmt } from '@/lib/time'
import { VIB_ALARM, TEMP_ALARM } from '@/lib/plant'

interface Item {
  id: string
  assetId: string
  hour: number
  trigger: string
  verdict: Verdict
  confidence: number
  needsHuman: boolean
  reason: string
  line: string
  truthReal: boolean
}
interface Series {
  from: number
  alertAt: number
  vib: number[]
  temp: number[]
  load: number[]
  running: boolean[]
}
interface Detail {
  result: Result
  series: Series
  truth: { real: boolean; mode?: string; faultFailAt?: number }
}
type Decision = { action: string; at: string; note?: string }

const cls = (v: Verdict) => (v === 'Act now' ? 'act' : v === 'Plan in window' ? 'plan' : v === 'Watch' ? 'watch' : 'supp')
const VERDICTS: Verdict[] = ['Act now', 'Plan in window', 'Watch', 'Suppress']

function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage unavailable, state stays in memory */
  }
}

function Chart({ s, title, unit, alarm, color }: { s: Series; title: string; unit: string; alarm?: number; color: string }) {
  const data = title === 'Vibration' ? s.vib : s.temp
  const W = 520
  const H = 130
  const lo = Math.min(...data.filter((_, i) => s.running[i]), alarm ?? Infinity) * 0.9
  const hi = Math.max(...data, alarm ?? 0) * 1.05
  const x = (i: number) => (i / (data.length - 1)) * (W - 40) + 34
  const y = (v: number) => H - 18 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (H - 30)
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ax = x(s.alertAt - s.from)
  return (
    <div>
      <div className="note"><b>{title}</b> ({unit}) · last 4 days to the alert, red line is the legacy fixed threshold</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title} chart`}>
        <rect x="34" y="4" width={W - 40} height={H - 22} fill="#F8FAFC" />
        {alarm !== undefined && <line x1="34" x2={W - 6} y1={y(alarm)} y2={y(alarm)} stroke="#D64545" strokeDasharray="4 3" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
        <line x1={ax} x2={ax} y1="4" y2={H - 18} stroke="#0B1F3A" strokeDasharray="2 2" />
        <text x={ax + 3} y="14" fontSize="10" fill="#0B1F3A">alert</text>
        <text x="2" y="12" fontSize="10" fill="#6B7785">{hi.toFixed(0)}</text>
        <text x="2" y={H - 18} fontSize="10" fill="#6B7785">{lo.toFixed(0)}</text>
      </svg>
    </div>
  )
}

interface AgentOut {
  skipped?: string
  source: 'llm' | 'rules'
  provider?: string
  fallbackReason?: string
  steps: { n: number; kind: string; name: string; summary: string; ms: number }[]
  usage: { prompt: number; completion: number; calls: number }
  totalMs: number
  verdict: string
  verifier?: { ran: boolean; approved: boolean | null; concerns: string[]; revised: boolean }
  comms?: { source: 'llm' | 'template'; supervisor: string; technician: string; stores: string; note?: string }
  final: { mode: string; confidence: number; rationale: string; citations: { doc: string; section: string }[]; needsHuman: boolean; flags: string[] }
}

export default function Desk() {
  const [items, setItems] = useState<Item[]>([])
  const [outcomes, setOutcomes] = useState<Outcomes>({})
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [filter, setFilter] = useState<Verdict | 'All'>('Act now')
  const [line, setLine] = useState('All')
  const [sel, setSel] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [explain, setExplain] = useState<{ text: string; source: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [agent, setAgent] = useState<AgentOut | null>(null)
  const [agentBusy, setAgentBusy] = useState(false)
  const [agentErr, setAgentErr] = useState('')
  const [truth, setTruth] = useState(false)
  const [ready, setReady] = useState(false)
  const [lines, setLines] = useState<{ id: string; name: string }[]>([])
  const [tab, setTab] = useState<'overview' | 'agent' | 'order' | 'activity'>('overview')
  const [toast, setToast] = useState('')
  const [guide, setGuide] = useState(false)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    setOutcomes(load('rd_outcomes', {}))
    setDecisions(load('rd_decisions', {}))
    setReady(true)
  }, [])

  const refresh = useCallback(async (o: Outcomes) => {
    const r = await fetch('/api/plant', { method: 'POST', body: JSON.stringify({ outcomes: o }) })
    const j = await r.json()
    setItems(j.items)
    setLines(j.lines)
    const firstAct = (j.items as Item[]).find((x) => x.verdict === 'Act now')
    if (firstAct) setSel((cur) => cur ?? firstAct.id) // land on a full case so the demo starts immediately
  }, [])

  useEffect(() => {
    if (ready) refresh(outcomes)
  }, [ready, outcomes, refresh])

  const open = useCallback(
    async (id: string) => {
      setSel(id)
      setExplain(null)
      setAgent(null)
      setAgentErr('')
      const r = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ alertId: id, outcomes }) })
      if (r.ok) setDetail(await r.json())
    },
    [outcomes]
  )

  // first load: the auto-selected Act now case has no detail yet, so fetch it
  useEffect(() => {
    if (sel && ready && !detail) open(sel)
  }, [sel, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the open alert in sync when learning changes the verdicts
  useEffect(() => {
    if (sel && ready) open(sel)
  }, [outcomes]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = { 'Act now': 0, 'Plan in window': 0, Watch: 0, Suppress: 0 }
    items.forEach((i) => (c[i.verdict] += 1))
    return c
  }, [items])
  const escalated = counts['Act now'] + counts['Plan in window']
  const noiseCut = items.length ? Math.round((1 - (escalated + items.filter((i) => i.verdict === 'Watch' && i.needsHuman).length) / items.length) * 100) : 0

  const shown = items
    .filter((i) => (filter === 'All' ? true : i.verdict === filter))
    .filter((i) => (line === 'All' ? true : i.line === line))
    .slice()
    .reverse()

  const logDecision = (id: string, d: Decision) => {
    const n = { ...decisions, [id]: d }
    setDecisions(n)
    save('rd_decisions', n)
  }
  const logOutcome = (id: string, assetId: string, label: OutcomeLabel) => {
    const n = { ...outcomes, [id]: { assetId, label } }
    setOutcomes(n)
    save('rd_outcomes', n)
    logDecision(id, { ...(decisions[id] || { action: 'outcome logged', at: new Date().toISOString() }), note: `Outcome: ${label}` })
  }
  const reset = () => {
    setOutcomes({})
    setDecisions({})
    save('rd_outcomes', {})
    save('rd_decisions', {})
  }
  const askAI = async () => {
    if (!sel) return
    setBusy(true)
    const r = await fetch('/api/explain', { method: 'POST', body: JSON.stringify({ alertId: sel, outcomes }) })
    setExplain(await r.json())
    setBusy(false)
  }

  const runAgent = async () => {
    if (!sel) return
    setAgentBusy(true)
    setAgentErr('')
    try {
      const x = await fetch('/api/agent', { method: 'POST', body: JSON.stringify({ alertId: sel, outcomes }) })
      const j = await x.json()
      if (!x.ok) setAgentErr(j.error || 'The agent could not run.')
      else setAgent(j)
    } catch {
      setAgentErr('Network error, try again.')
    }
    setAgentBusy(false)
  }

  const r = detail?.result
  const dec = sel ? decisions[sel] : undefined
  const escalatable = r && (r.adjudication.verdict === 'Act now' || r.adjudication.verdict === 'Plan in window')
  const hasPlan = !!(r && r.diagnosis && r.resources && r.plan && r.comms)
  const pick = (id: string) => { setTab('overview'); open(id) }
  const approve = () => {
    if (!r) return
    logDecision(r.candidate.id, { action: 'Approved work order', at: new Date().toISOString() })
    setToast(r.plan ? `${r.plan.workOrder.id} approved. Technician ${r.plan.techName} and stores notified (demo: no CMMS connected).` : 'Approved.')
  }

  // opening the Agent workflow tab starts the agents automatically (once per case)
  useEffect(() => {
    if (tab === 'agent' && hasPlan && !agent && !agentBusy && !agentErr) runAgent()
  }, [tab, hasPlan, agent, agentBusy, agentErr]) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { id: typeof tab; label: string; off?: boolean }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'agent', label: 'Agent workflow', off: !hasPlan },
    { id: 'order', label: 'Work order', off: !hasPlan },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="app">
      <aside className="queue">
        <div className="qhead">
          <div className="qtitle">
            <h1>Alerts</h1>
            <button className="linkbtn" onClick={() => setGuide(true)}>Demo guide</button>
          </div>
          <div className="qsum">
            <span><b>{escalated}</b> need action</span>
            <span><b>{counts['Suppress']}</b> auto-suppressed</span>
            <span><b>{noiseCut}%</b> less noise</span>
          </div>
          <div className="seg" role="tablist" aria-label="Verdict filter">
            {(['Act now', 'Plan in window', 'Watch', 'Suppress', 'All'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={filter === v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>
                {v === 'Plan in window' ? 'Plan' : v === 'Suppress' ? 'Muted' : v}
                {v !== 'All' && <i>{counts[v]}</i>}
              </button>
            ))}
          </div>
          <select value={line} onChange={(e) => setLine(e.target.value)} aria-label="Line filter" className="lsel">
            <option value="All">All lines</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="qlist">
          {shown.slice(0, 300).map((i) => (
            <button key={i.id} className={'qrow ' + cls(i.verdict) + (sel === i.id ? ' sel' : '')} onClick={() => pick(i.id)}>
              <span className="sev" />
              <span className="qmain">
                <span className="qa">{i.assetId}<em>{i.trigger}</em></span>
                <span className="qt">{fmt(i.hour)}{decisions[i.id] ? ' · ' + decisions[i.id].action : ''}</span>
              </span>
              <span className={'pill ' + cls(i.verdict)}>{i.verdict === 'Plan in window' ? 'Plan' : i.verdict}{i.needsHuman ? ' *' : ''}</span>
            </button>
          ))}
          {!shown.length && <div className="pad muted">No alerts in this view.</div>}
        </div>
        <div className="qfoot">* low confidence or missing data, handed to a human</div>
      </aside>

      <main className="case">
        {!r && <div className="empty"><h2>Select an alert</h2><p>Pick an alert from the queue to see the verdict, evidence and proposed work order.</p></div>}
        {r && detail && (
          <>
            <header className="chead">
              <div className="ctitle">
                <h2>{r.asset.id} <small>{r.asset.type}</small></h2>
                <div className="cmeta">
                  <span className={'pill ' + cls(r.adjudication.verdict)}>{r.adjudication.verdict}{r.adjudication.needsHuman ? ' (human review)' : ''}</span>
                  <span>{r.context.lineName}</span><span>{fmt(r.candidate.hour)}</span><span>confidence {Math.round(r.adjudication.confidence * 100)}%</span>
                </div>
              </div>
              <div className="cact">
                {dec ? (
                  <span className="done">{dec.action}</span>
                ) : (
                  <>
                    {escalatable
                      ? <button className="btn pri" onClick={approve}>Approve work order</button>
                      : <button className="btn sec" onClick={() => logDecision(r.candidate.id, { action: 'Brought back for review', at: new Date().toISOString() })}>Bring back for review</button>}
                    <button className="btn ghost" onClick={() => logDecision(r.candidate.id, { action: 'Overridden by supervisor', at: new Date().toISOString() })}>Override</button>
                  </>
                )}
              </div>
            </header>
            <nav className="tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} disabled={t.off} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </nav>

            <div className="cbody fade" key={r.candidate.id + tab}>
              {tab === 'overview' && (
                <>
                  <section className="card2">
                    <p className="headline">{r.adjudication.reason}</p>
                    <ul className="ev">{r.adjudication.evidence.map((e, k) => <li key={k}>{e}</li>)}</ul>
                    <div className="actions">
                      <button className="btn sec" onClick={askAI} disabled={busy}>{busy ? 'Thinking...' : 'Explain in plain English'}</button>
                    </div>
                    {explain && <div className="box" style={{ marginTop: 10 }}>{explain.text}<div className="note">Source: {explain.source}</div></div>}
                  </section>
                  <section className="card2 grid2">
                    <Chart s={detail.series} title="Vibration" unit="mm/s" alarm={VIB_ALARM} color="#0FA3A3" />
                    <Chart s={detail.series} title="Temperature" unit="deg C" alarm={TEMP_ALARM} color="#F2A33A" />
                  </section>
                  {hasPlan && r.diagnosis && r.plan && (
                    <section className="card2 nextstep">
                      <div>
                        <div className="eyebrow">Likely cause</div>
                        <b>{r.diagnosis.mode}</b> <span className="muted">({Math.round(r.diagnosis.confidence * 100)}%)</span>
                        <div className="note">{r.diagnosis.action}.</div>
                      </div>
                      <div>
                        <div className="eyebrow">Proposed slot</div>
                        <b>{fmt(r.plan.slotStart)}</b>
                        <div className="note">{r.plan.techName}{r.plan.callIn ? ' (call-in)' : ''}</div>
                      </div>
                      <div className="actions">
                        <button className="btn pri" onClick={() => setTab('agent')}>Investigate with agents</button>
                        <button className="btn sec" onClick={() => setTab('order')}>Work order</button>
                      </div>
                    </section>
                  )}
                </>
              )}

              {tab === 'agent' && hasPlan && r.diagnosis && (
                <>
                  <section className="card2">
                    <div className="rowhd">
                      <div>
                        <div className="eyebrow">Diagnosis from rules and cited manuals</div>
                        <b>{r.diagnosis.mode}</b> <span className="muted">confidence {Math.round(r.diagnosis.confidence * 100)}%{r.diagnosis.confidence < 0.6 ? ' (preliminary, confirm on inspection)' : ''}</span>
                        <div className="note">Alternative: {r.diagnosis.alt}</div>
                      </div>
                      <button className="btn sec" onClick={runAgent} disabled={agentBusy}>{agentBusy ? 'Agents investigating...' : 'Run again'}</button>
                    </div>
                    <p style={{ margin: '8px 0' }}>{r.diagnosis.action}.</p>
                    {r.diagnosis.cite.map((c, k) => (
                      <div key={k} className="note cite">[{k + 1}] {c.doc}, {c.section}: {c.text} <a href={c.url} target="_blank" rel="noreferrer">source</a></div>
                    ))}
                    {agentErr && <div className="note" style={{ color: 'var(--red)', marginTop: 6 }}>{agentErr}</div>}
                  </section>

                  {agentBusy && <section className="card2 working"><span className="spin" /> Diagnosis, Verifier and Comms agents are working. This can take up to 40 seconds on free model tiers.</section>}

                  {agent && !agent.skipped && (
                    <section className="card2">
                      <div className="rowhd">
                        <div>
                          <div className="eyebrow">Agent result</div>
                          <b>{agent.final.mode}</b> <span className="muted">confidence {Math.round(agent.final.confidence * 100)}%</span>
                        </div>
                        <span className={'pill ' + (agent.source === 'llm' ? 'live' : 'supp')}>{agent.source === 'llm' ? `LLM: ${agent.provider}` : 'Rules only'}</span>
                      </div>
                      <p style={{ margin: '8px 0' }}>{agent.final.rationale}</p>
                      {agent.final.citations.map((c, k) => <div key={k} className="note">[{k + 1}] {c.doc}, {c.section}</div>)}
                      {agent.final.flags.map((f, k) => <div key={k} className="note" style={{ color: 'var(--red)' }}>Flag: {f}</div>)}
                      {agent.final.needsHuman && <div className="note"><b>Needs human review.</b></div>}
                      {agent.verifier?.ran && (
                        <div className="note" style={{ marginTop: 6 }}>Verifier: {agent.verifier.approved === true ? 'approved' : agent.verifier.approved === false ? `concerns raised (${agent.verifier.concerns.join('; ')})` : 'no clear verdict'}{agent.verifier.revised ? ', diagnosis was sent back and revised once' : ''}.</div>
                      )}
                      <ol className="tl">
                        {agent.steps.map((st) => (
                          <li key={st.n} className={st.kind}>
                            <b>{st.kind === 'tool' ? `Tool: ${st.name}` : st.name}</b> <span className="note">{st.ms} ms</span>
                            <div className="note">{st.summary}</div>
                          </li>
                        ))}
                      </ol>
                      <div className="note">{agent.totalMs} ms, {agent.usage.calls} model calls, {agent.usage.prompt + agent.usage.completion} tokens. The agent proposes a diagnosis only. The verdict ({agent.verdict}), thresholds, stock check and schedule stay in plain code.</div>
                      {agent.source === 'rules' && <div className="warnbox">AI provider not used: {agent.fallbackReason || 'no LLM key is configured on this deployment'}. This result comes from the rule-based path, so it is still safe and grounded, but the Verifier and Comms agents did not run on a model.</div>}
                      {agent.comms && (
                        <div className="msgs">
                          <div className="eyebrow">Messages drafted by the {agent.comms.source === 'llm' ? 'Comms agent (checked against the plan)' : 'template'}</div>
                          <div className="box"><b>Supervisor</b><div>{agent.comms.supervisor}</div></div>
                          <div className="box"><b>Technician</b><div>{agent.comms.technician}</div></div>
                          <div className="box"><b>Stores</b><div>{agent.comms.stores}</div></div>
                        </div>
                      )}
                    </section>
                  )}

                  <section className="card2">
                    <div className="eyebrow">Who decided what</div>
                    <table className="dwho"><tbody>
                      <tr><td>Verdict: {r.adjudication.verdict}</td><td><span className="badge code">Code</span> per-asset baselines, thresholds, learned adjustments</td></tr>
                      <tr><td>Failure mode and evidence</td><td><span className={'badge ' + (agent?.source === 'llm' ? 'llm' : 'code')}>{agent?.source === 'llm' ? 'LLM agent' : 'Rules'}</span> {agent?.source === 'llm' ? 'chose its own tool calls, answer must cite manual pages' : 'signature rules, cited from the manual library'}</td></tr>
                      <tr><td>Second opinion</td><td><span className={'badge ' + (agent?.verifier?.ran ? 'llm' : 'code')}>{agent?.verifier?.ran ? 'Verifier agent' : 'Not run'}</span> can send the diagnosis back once, then a human decides</td></tr>
                      <tr><td>Parts, stock, technician, slot</td><td><span className="badge code">Code</span> deterministic checks, never left to a model</td></tr>
                      <tr><td>Messages to supervisor, technician, stores</td><td><span className={'badge ' + (agent?.comms?.source === 'llm' ? 'llm' : 'code')}>{agent?.comms?.source === 'llm' ? 'Comms agent' : 'Template'}</span> checked against the plan, invented part numbers rejected</td></tr>
                      <tr><td>Approval and override</td><td><span className="badge human">Human</span> ReliaDesk never writes to a PLC or controls a machine</td></tr>
                    </tbody></table>
                  </section>

                  <details className="card2 more">
                    <summary>Orchestrator trace (rules engine, in order)</summary>
                    <div className="trace">
                      {r.trace.map((t, k) => (
                        <div key={k}>
                          <span className="ag">{t.agent}</span>
                          <span className={t.kind === 'loop' ? 'loop' : t.kind === 'skip' ? 'skip' : ''}>{t.kind === 'loop' ? 'LOOP BACK: ' : ''}{t.summary}</span>
                          <span className="note" style={{ marginLeft: 'auto' }}>{t.tool}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}

              {tab === 'order' && hasPlan && r.resources && r.plan && r.comms && (
                <>
                  <section className="card2 grid2">
                    <div>
                      <div className="eyebrow">Parts</div>
                      <table>
                        <thead><tr><th>Part</th><th>Qty</th><th>Stock</th></tr></thead>
                        <tbody>
                          {r.resources.parts.map((p) => (
                            <tr key={p.no}><td>{p.no}</td><td>{p.qty}</td><td className={p.inStock ? 'ok' : 'bad'}>{p.inStock ? 'In stock' : `Order, ETA ${Math.round(p.etaHours / 24)} d`}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className="eyebrow">Schedule</div>
                      <p style={{ margin: '4px 0' }}><b>{r.plan.techName}</b>{r.plan.callIn ? ' (call-in, slot is outside shift)' : ' (on shift)'}</p>
                      <p style={{ margin: 0 }}>{fmt(r.plan.slotStart)} to {fmt(r.plan.slotEnd)}<br /><span className="note">{r.plan.type === 'immediate' ? 'Immediate stop' : r.plan.type === 'sunday' ? 'Sunday full stop' : 'Planned window'}</span></p>
                      {!r.plan.withinHorizon && <p className="bad" style={{ margin: '6px 0 0' }}>Slot is later than the {r.plan.horizonH} h risk horizon. Expedite parts or add a temporary mitigation.</p>}
                    </div>
                  </section>
                  <section className="card2 grid2">
                    <pre className="wo">{`${r.plan.workOrder.id}  ${r.plan.workOrder.priority}
${r.plan.workOrder.title}
Asset:  ${r.plan.workOrder.asset}
Window: ${r.plan.workOrder.start} to ${r.plan.workOrder.end}
Tech:   ${r.plan.workOrder.tech}
Parts:  ${r.plan.workOrder.parts.join('; ')}
Steps:
${r.plan.workOrder.steps.map((s2, k) => ` ${k + 1}. ${s2}`).join('\n')}`}</pre>
                    <div className="stack">
                      <div className="box"><b>Supervisor</b><div>{r.comms.supervisor}</div></div>
                      <div className="box"><b>Technician</b><div>{r.comms.technician}</div></div>
                      <div className="box"><b>Stores</b><div>{r.comms.stores}</div></div>
                    </div>
                  </section>
                </>
              )}

              {tab === 'activity' && (
                <>
                  <section className="card2">
                    <div className="eyebrow">Technician outcome</div>
                    <div className="actions">
                      <button className="btn sec" onClick={() => logOutcome(r.candidate.id, r.asset.id, 'confirmed')}>Fault confirmed</button>
                      <button className="btn sec" onClick={() => logOutcome(r.candidate.id, r.asset.id, 'no_fault')}>No fault found</button>
                      <button className="btn sec" onClick={() => logOutcome(r.candidate.id, r.asset.id, 'other')}>Other</button>
                      {outcomes[r.candidate.id] && <span className="note">Learning: {r.asset.id} threshold {r.adjudication.adj >= 0 ? '+' : ''}{r.adjudication.adj.toFixed(1)} z</span>}
                    </div>
                    <div className="note" style={{ marginTop: 8 }}>Outcomes tune this asset&apos;s own threshold. ReliaDesk never writes to a PLC or controls a machine; every action is a recommendation a human approves.</div>
                  </section>
                  <section className="card2">
                    <div className="eyebrow">Audit log ({Object.keys(decisions).length})</div>
                    {Object.keys(decisions).length === 0 && <span className="muted">No supervisor decisions yet.</span>}
                    <table><tbody>
                      {Object.entries(decisions).map(([id, d]) => (
                        <tr key={id}><td>{id}</td><td>{d.action}{d.note ? ` · ${d.note}` : ''}</td><td className="note">{d.at.slice(0, 19).replace('T', ' ')}</td></tr>
                      ))}
                    </tbody></table>
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="btn ghost" onClick={reset}>Reset decisions and learning</button>
                      <label className="note"><input type="checkbox" checked={truth} onChange={(e) => setTruth(e.target.checked)} /> demo only: show simulator ground truth</label>
                    </div>
                    {truth && <div className="box" style={{ marginTop: 8 }}>Ground truth: {detail.truth.real ? `real fault (${detail.truth.mode}), fails at ${fmt(detail.truth.faultFailAt || 0)}` : 'no fault, this alert is noise'}</div>}
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
      {guide && (
        <div className="modal" onClick={() => setGuide(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rowhd"><h2 style={{ margin: 0, fontSize: 18 }}>Demo guide</h2><button className="btn ghost" onClick={() => setGuide(false)}>Close</button></div>
            <p className="note">ReliaDesk replays 30 days of a 3-line, 40-asset plant. Legacy thresholds raised {items.length} alerts after the learning period.</p>
            <ol className="guidelist">
              <li>Open an <b>Act now</b> alert, read the evidence and charts.</li>
              <li>On <b>Agent workflow</b>, click <b>Run agent workflow</b> to watch the Diagnosis, Verifier and Comms agents work.</li>
              <li>Check the <b>Work order</b>, then <b>Approve</b> or <b>Override</b>.</li>
              <li>In <b>Activity</b>, log the technician outcome and see that asset&apos;s threshold learn.</li>
              <li><b>Performance</b> compares ReliaDesk with fixed thresholds on the same 30 days. <b>Case file</b> holds the business case, architecture, evidence and alternatives.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
