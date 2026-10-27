'use client'
import { useMemo, useState } from 'react'
import { computeRoi, REFERENCE, crore, lakh, type RoiInput } from '@/lib/roi'

const SCEN: { id: string; label: string; patch: Partial<RoiInput> }[] = [
  { id: 'base', label: 'Base: 30% cut (case target)', patch: { cutPct: 30, labourShare: 1 } },
  { id: 'stress', label: 'Stress: 10% cut, half the labour gain', patch: { cutPct: 10, labourShare: 0.5 } },
  { id: 'abb', label: 'At ABB India typical cost per hour', patch: { cutPct: 30, labourShare: 1, costPerHour: 7_000_000 } },
]

const RISKS = [
  ['A real fault is suppressed', 'Fail-open: low confidence or thin history always goes to a human. Suppression is reversible and audited. Missed-fault rate is reported next to the noise cut, with a 95%+ recall target proven in shadow mode.'],
  ['IT and OT will not allow a new system', 'Read-only integration with the sensors, CMMS or SAP PM and roster. It never writes to a PLC or controls a machine. Sensor vendors are channels, not rivals.'],
  ['Supervisors do not trust the verdict', 'Every verdict carries evidence and citations, the supervisor can override, and the desk learns from the technician outcome.'],
  ['The language model is wrong or invents a source', 'Citations must match a stored excerpt, a second agent checks the diagnosis, disagreements go to a human, and the rule-based path takes over on any failure.'],
  ['Pilot does not convert to a subscription', 'Free two-week Alert Audit on the plant\'s own logs first, then a six-week shadow pilot with written go or no-go gates. Conversion is the most sensitive business input.'],
  ['Poor data quality or new equipment', 'First seven days are a learning period, repaired assets reset their baseline, and baselines under 150 clean hours hand the alert to a human.'],
]

const PHASES = [
  ['Weeks 1 to 2', 'Free Alert Audit', 'Plant exports its own alert logs. ReliaDesk replays them and reports how many escalations were noise.', 'Gate: a quantified noise share the plant agrees with.'],
  ['Weeks 3 to 8', 'Shadow pilot, one line', 'Runs beside the existing process. No actions taken. About ₹6 lakh. Supervisors compare verdicts with what they did.', 'Gate: missed-fault rate at or under target, false escalations cut by 80% on replay.'],
  ['Weeks 9 to 12', 'Approval mode', 'Supervisors approve drafted work orders. Subscription starts.', 'Gate: approval rate and technician outcomes logged.'],
  ['Month 4 onward', 'Plant rollout, then multi-plant', 'More lines, then more plants, with the learning loop tuning thresholds per asset.', 'Gate: measured downtime hours versus the baseline year.'],
]

function Slider({ label, value, min, max, step, onChange, show }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; show: string }) {
  return (
    <div className="slider">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <b>{show}</b>
    </div>
  )
}

export default function Impact() {
  const [v, setV] = useState<RoiInput>(REFERENCE)
  const [scen, setScen] = useState('base')
  const r = useMemo(() => computeRoi(v), [v])
  const set = (p: Partial<RoiInput>) => { setV({ ...v, ...p }); setScen('custom') }
  const pick = (id: string) => { const s = SCEN.find((x) => x.id === id)!; setV({ ...REFERENCE, ...s.patch }); setScen(id) }
  const max = Math.max(r.total, r.price) || 1
  const grid = [5, 10, 20, 30]
  const costs = [1_000_000, 2_500_000, 7_000_000]

  return (
    <>
      <section className="hero fade">
        <h1>The business case: pays for itself at a 3.7% cut in unplanned downtime.</h1>
        <p>Change any assumption and the model recomputes. Defaults reproduce the 250-asset reference plant in the deck. Every input is an assumption that the free Alert Audit replaces with the plant&apos;s own numbers.</p>
        <div className="tags"><span className="tag">Reference plant, modelled</span><span className="tag">Conservative ₹10 lakh per hour</span><span className="tag">Not a measured result</span></div>
      </section>
      <main className="page">
        <div className="actions" style={{ marginBottom: 12 }}>
          {SCEN.map((s) => <button key={s.id} className={`chipbtn ${scen === s.id ? 'on' : ''}`} onClick={() => pick(s.id)}>{s.label}</button>)}
          {scen === 'custom' && <span className="pill watch">Custom inputs</span>}
        </div>
        <div className="grid2">
          <div className="panel"><h3>Assumptions</h3><div className="pad">
            <Slider label="Monitored assets" value={v.assets} min={50} max={1000} step={10} onChange={(n) => set({ assets: n })} show={String(v.assets)} />
            <Slider label="Price per asset per month" value={v.pricePerAssetMonth} min={1000} max={10000} step={250} onChange={(n) => set({ pricePerAssetMonth: n })} show={`₹${v.pricePerAssetMonth.toLocaleString('en-IN')}`} />
            <Slider label="Cost per downtime hour" value={v.costPerHour} min={500000} max={10000000} step={250000} onChange={(n) => set({ costPerHour: n })} show={lakh(v.costPerHour)} />
            <Slider label="Unplanned downtime cut" value={v.cutPct} min={0} max={50} step={1} onChange={(n) => set({ cutPct: n })} show={`${v.cutPct}%`} />
            <Slider label="Labour gain realised" value={v.labourShare} min={0} max={1} step={0.05} onChange={(n) => set({ labourShare: n })} show={`${Math.round(v.labourShare * 100)}%`} />
            <Slider label="Loaded labour cost per hour" value={v.labourRate} min={200} max={1500} step={50} onChange={(n) => set({ labourRate: n })} show={`₹${v.labourRate}`} />
            <p className="note">Downtime baseline: {v.downtimeHrsPerAssetYear.toFixed(2)} hours per asset per year (27 hours a month for 250 assets). Labour: {v.labourHrsWeekPerAsset.toFixed(2)} supervisor and technician hours freed per asset per week (144 a week at 250 assets, from an 80% cut in false escalations).</p>
          </div></div>
          <div className="stack">
            <div className="cards" style={{ marginBottom: 0 }}>
              <div className="card"><h4>Annual benefit</h4><div className="big">{crore(r.total)}</div><span className="note">{crore(r.downtimeBenefit)} downtime + {crore(r.labourBenefit)} labour</span></div>
              <div className="card"><h4>Annual price</h4><div className="big" style={{ color: 'var(--navy)' }}>{crore(r.price)}</div><span className="note">{v.assets} assets × ₹{v.pricePerAssetMonth.toLocaleString('en-IN')} × 12</span></div>
              <div className="card"><h4>Return multiple</h4><div className="big">{r.multiple.toFixed(1)}x</div><span className="note">benefit divided by price</span></div>
              <div className="card"><h4>Payback</h4><div className="big">{r.paybackMonths.toFixed(1)} mo</div><span className="note">price recovered from benefit</span></div>
              <div className="card"><h4>Break-even cut</h4><div className="big">{r.breakEvenCutPct.toFixed(1)}%</div><span className="note">downtime cut that covers the price</span></div>
              <div className="card"><h4>Hours avoided</h4><div className="big">{Math.round(r.avoidedHrs)}</div><span className="note">downtime hours a year, plus {Math.round(r.labourHrsYear).toLocaleString('en-IN')} labour hours</span></div>
            </div>
            <div className="panel"><h3>Benefit against price (₹ crore a year)</h3><div className="pad">
              {[['Benefit', r.total, 'var(--teal)'], ['Price', r.price, 'var(--navy)']].map(([n, val, c]) => (
                <div key={String(n)} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 120px', gap: 10, alignItems: 'center', margin: '8px 0' }}>
                  <b>{n}</b><div style={{ background: '#eef3f7', borderRadius: 8 }}><div className="bar" style={{ width: `${Math.max(2, (Number(val) / max) * 100)}%`, background: String(c) }} /></div><b>{crore(Number(val))}</b>
                </div>
              ))}
            </div></div>
          </div>
        </div>

        <h2 className="section">Sensitivity: downtime benefit by cost per hour and cut achieved (₹ crore a year)</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Cost per downtime hour</th>{grid.map((g) => <th key={g}>{g}% cut</th>)}</tr></thead>
          <tbody>{costs.map((c) => (
            <tr key={c}><td><b>{lakh(c)}</b>{c === 1_000_000 ? ' (conservative)' : c === 7_000_000 ? ' (ABB India typical)' : ''}</td>
              {grid.map((g) => { const b = computeRoi({ ...v, costPerHour: c, cutPct: g, labourShare: 0 }).downtimeBenefit; return <td key={g} className={b >= r.price ? 'ok' : 'bad'}>{(b / 1e7).toFixed(2)}</td> })}</tr>
          ))}</tbody>
        </table></div>
        <p className="note">Green cells cover the annual price of {crore(r.price)} from downtime alone. Labour savings are excluded here.</p>

        <h2 className="section">Pilot plan with go or no-go gates</h2>
        <div className="grid3">{PHASES.map(([w, t, d, g]) => (
          <div key={t} className="card"><h4>{w}</h4><b style={{ color: 'var(--navy)' }}>{t}</b><p style={{ margin: '6px 0' }}>{d}</p><span className="note">{g}</span></div>
        ))}</div>

        <h2 className="section">Risks and mitigation</h2>
        <div className="tablewrap"><table>
          <thead><tr><th style={{ width: '28%' }}>Risk</th><th>Mitigation built into the product or the plan</th></tr></thead>
          <tbody>{RISKS.map(([a, b]) => <tr key={a}><td><b>{a}</b></td><td>{b}</td></tr>)}</tbody>
        </table></div>
        <div className="callout warn"><b>Estimated costs.</b> Pilot: about ₹6 lakh for a six-week shadow pilot on one line. The MVP runs on free tiers of hosting and language-model providers. Production model costs depend on the provider chosen; the agent trace already shows tokens per case so cost per alert can be measured in the pilot.</div>
      </main>
    </>
  )
}
