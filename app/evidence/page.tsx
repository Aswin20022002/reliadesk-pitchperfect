import { IMS } from '@/lib/imsData'
import { MODES } from '@/lib/kb'
import { referenceDefectFrequencies } from '@/lib/refBearing'

export const metadata = { title: 'ReliaDesk evidence' }

const COLORS = ['#0FA3A3', '#D64545', '#F2A33A', '#5B7C99']

function Chart() {
  const W = 760, H = 300, L = 46, B = 34, T = 14, R = 14
  const n = IMS.curves[0].ratio.length
  const cap = 12
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - Math.min(v, cap) / cap) * (H - T - B)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Real vibration RMS ratio of four IMS bearings over their last 168 hours before failure" style={{ width: '100%', maxWidth: 980, height: 'auto', display: 'block', background: '#fff', borderRadius: 14, border: '1px solid var(--line)' }}>
      {[0, 2, 4, 6, 8, 10, 12].map((g) => (
        <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e3e9f0" /><text x={L - 8} y={y(g) + 4} fontSize="11" textAnchor="end" fill="#5f6e7f">{g}x</text></g>
      ))}
      <line x1={L} x2={W - R} y1={y(1)} y2={y(1)} stroke="#1a8f5a" strokeDasharray="4 4" />
      <text x={L + 6} y={y(1) - 6} fontSize="11" fill="#1a8f5a">healthy baseline (1x)</text>
      {IMS.curves.map((c, k) => (
        <polyline key={c.source} fill="none" stroke={COLORS[k]} strokeWidth="2.2" strokeLinejoin="round" points={(c.ratio as readonly number[]).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
      ))}
      {[0, 42, 84, 126, 167].map((i) => <text key={i} x={x(i)} y={H - 12} fontSize="11" textAnchor={i === 0 ? 'start' : i === 167 ? 'end' : 'middle'} fill="#5f6e7f">{i === 167 ? 'failure' : `${168 - i} h before`}</text>)}
    </svg>
  )
}

export default function Evidence() {
  const seen = new Map<string, { doc: string; url: string; pages: Set<string> }>()
  for (const m of Object.values(MODES)) for (const c of m.cite) { const e = seen.get(c.url) || { doc: c.doc, url: c.url, pages: new Set<string>() }; e.pages.add(c.section); seen.set(c.url, e) }
  const f = referenceDefectFrequencies()
  return (
    <>
      <section className="hero fade">
        <h1>Evidence: what is real data, what is simulated, and what we do not claim.</h1>
        <p>The bearing degradation and sensor noise in the replay come from a public NASA run-to-failure dataset. The manual excerpts are paraphrased from two public references. Everything else is labelled as a model.</p>
        <div className="tags"><span className="tag">NASA IMS bearing data</span><span className="tag">NASA KSC AT-8</span><span className="tag">NSK / Texas A&amp;M 2011</span></div>
      </section>
      <main className="page">
        <h2 className="section">Real run-to-failure signals used in the replay</h2>
        <p className="lead">Vibration RMS of four real bearings, as a multiple of each bearing&apos;s own healthy baseline, over their last 168 hours. Many stay flat for days and then rise sharply, which is why early, honest detection is hard.</p>
        <Chart />
        <div className="actions" style={{ marginTop: 8 }}>{IMS.curves.map((c, k) => <span key={c.source} className="pill" style={{ background: COLORS[k] }}>{c.source}, peak {Math.max(...(c.ratio as readonly number[])).toFixed(1)}x</span>)}</div>
        <p className="note">Source: J. Lee, H. Qiu, G. Yu, J. Lin, Rexnord Technical Services (2007), IMS, University of Cincinnati, Bearing Data Set, NASA Prognostics Data Repository. RMS features via github.com/fatemeh-studio/nasa-bearing-anomaly (MIT licence).</p>

        <h2 className="section">Real versus simulated</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Part of the replay</th><th>Status</th><th>Source or note</th></tr></thead>
          <tbody>
            <tr><td>Bearing-wear fault curves (4 of 10 faults)</td><td><span className="badge llm">Real</span></td><td>Measured on real bearings in the NASA IMS test rig</td></tr>
            <tr><td>Sensor noise on every asset ({IMS.noise.length} hourly samples)</td><td><span className="badge llm">Real</span></td><td>Healthy-bearing measurements from the same dataset</td></tr>
            <tr><td>Bearing defect frequencies in the agent tool</td><td><span className="badge llm">Real physics</span></td><td>Computed from the published ZA-2115 geometry at 2,000 rpm: outer race {f.outerRaceHz} Hz, inner race {f.innerRaceHz} Hz, roller spin {f.rollerSpinHz} Hz, cage {f.cageHz} Hz. Reference rig only.</td></tr>
            <tr><td>Manual excerpts and citations</td><td><span className="badge llm">Real source</span></td><td>Short paraphrases of two public documents, with pages and links (below)</td></tr>
            <tr><td>Plant, load, start-ups, ambient heat, temperature, 6 other faults</td><td><span className="badge code">Simulated</span></td><td>Seeded and repeatable. The IMS rig ran at constant load and has no temperature channel.</td></tr>
            <tr><td>Stock, roster, part numbers, repair hours, CMMS history</td><td><span className="badge code">Synthetic</span></td><td>Replaced by the plant&apos;s SAP, roster system and OEM manuals in a pilot</td></tr>
            <tr><td>Business inputs (price, cost per hour, labour rate)</td><td><span className="badge human">Assumption</span></td><td>Cost per hour is conservative at ₹10 lakh against an ABB India typical of about ₹70 lakh. The Alert Audit replaces these.</td></tr>
          </tbody>
        </table></div>

        <h2 className="section">References behind the diagnosis excerpts</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Document</th><th>Pages used</th></tr></thead>
          <tbody>{[...seen.values()].map((e) => <tr key={e.url}><td><a href={e.url} target="_blank" rel="noreferrer">{e.doc}</a></td><td>{[...e.pages].join('; ')}</td></tr>)}</tbody>
        </table></div>

        <h2 className="section">Honest limits</h2>
        <div className="callout warn"><ul className="ev">
          <li>Only bearing-wear signatures and sensor noise are real measurements. The plant around them is simulated, so replay results show the logic working on a designed plant, not a real one.</li>
          <li>Real bearing faults are hard: some stay near baseline until about a day before failure. The replay reports the resulting misses as they are.</li>
          <li>The references support symptoms and remedies. Numeric signatures, repair hours and part numbers are model parameters for the demo.</li>
          <li>Real alert logs with confirmed outcomes are not public. The Alert Audit and shadow pilot are how they are obtained.</li>
        </ul></div>
      </main>
    </>
  )
}
