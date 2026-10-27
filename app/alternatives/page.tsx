export const metadata = { title: 'ReliaDesk alternatives' }

type L = 'full' | 'part' | 'none'
const SYM: Record<L, string> = { full: '●', part: '◐', none: '○' }
const MATRIX: [string, L[]][] = [
  ['Augury with Fiix or MaintainX', ['full', 'part', 'none', 'none', 'part', 'part']],
  ['Tractian', ['part', 'none', 'part', 'none', 'part', 'part']],
  ['IBM Maximo', ['part', 'part', 'full', 'none', 'part', 'none']],
  ['Siemens Senseye', ['part', 'part', 'none', 'none', 'part', 'part']],
  ['ReliaDesk (designed scope)', ['full', 'full', 'full', 'full', 'full', 'full']],
]
const COLS = ['Alert triage', 'Manual-based diagnosis', 'Spares and technician', 'Production window', 'Explainable and audited', 'Any sensor, any CMMS, mid-size price']

export default function Alternatives() {
  return (
    <>
      <section className="hero fade">
        <h1>Alternatives considered, and why the decision layer is the gap.</h1>
        <p>Sensors detect and maintenance tools execute. The decision between them is owned by nobody. This page compares the options a plant has today and the technical choices behind the MVP.</p>
        <div className="tags"><span className="tag">Based on public materials</span><span className="tag">Not evident does not prove absence</span></div>
      </section>
      <main className="page">
        <h2 className="section">Where existing tools stop</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Product</th>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{MATRIX.map(([n, row]) => <tr key={n} style={n.startsWith('ReliaDesk') ? { background: '#e8f8f6', fontWeight: 700 } : undefined}><td>{n}</td>{row.map((x, i) => <td key={i} style={{ fontSize: 18, color: x === 'none' ? '#8a94a1' : 'var(--teal)' }}>{SYM[x]}</td>)}</tr>)}</tbody>
        </table></div>
        <p className="note">● shown in public material · ◐ partial or only inside the vendor&apos;s ecosystem · ○ not evident. Competitor cells are an assessment of public material. The ReliaDesk row shows designed scope, which the MVP demonstrates on replay data and a pilot would prove in a plant.</p>

        <h2 className="section">Options a plant has</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Option</th><th>What you get</th><th>Where it falls short for this problem</th></tr></thead>
          <tbody>
            <tr><td><b>Keep fixed thresholds</b></td><td>Free, familiar, already running</td><td>Thousands of false alerts a week, alarm fatigue, nothing connects an alert to parts, people or the production window.</td></tr>
            <tr><td><b>Buy a predictive-maintenance platform</b></td><td>Strong anomaly detection and dashboards</td><td>Often tied to one vendor&apos;s sensors or ecosystem, and still leaves the supervisor to chase manuals, stock and roster by phone.</td></tr>
            <tr><td><b>Build in house</b></td><td>Fits the plant exactly</td><td>Needs data science, integration and LLM engineering most mid-size plants do not have, and no outcome-learning loop out of the box.</td></tr>
            <tr><td><b>ReliaDesk, a decision layer</b></td><td>Verdict, cited diagnosis, constraint check and a drafted work order on top of existing sensors and CMMS</td><td>Needs read access to alert, CMMS and roster data, which is why the pilot starts with a free Alert Audit on exported logs.</td></tr>
          </tbody>
        </table></div>

        <h2 className="section">Technical alternatives behind the MVP</h2>
        <div className="grid2">
          <div className="stack">
            <h3 style={{ margin: 0 }}>Language-model providers (free tiers)</h3>
            <div className="tablewrap"><table>
              <thead><tr><th>Provider</th><th>Free?</th><th>Role here</th></tr></thead>
              <tbody>
                <tr><td>Groq</td><td>Yes, no card</td><td>Primary: fast, tool calling</td></tr>
                <tr><td>Google AI Studio (Gemini)</td><td>Yes, no card</td><td>Backup</td></tr>
                <tr><td>OpenRouter free models</td><td>Yes, tight daily caps</td><td>Second backup</td></tr>
                <tr><td>xAI Grok</td><td>Promotional credits only</td><td>Optional, not a dependency</td></tr>
                <tr><td>Anthropic Claude</td><td>Paid</td><td>Possible production upgrade for the Diagnosis agent</td></tr>
              </tbody>
            </table></div>
            <p className="note">Free tiers change without notice, so the app tries several models and providers and falls back to rules.</p>
          </div>
          <div className="stack">
            <h3 style={{ margin: 0 }}>Hosting and agent design</h3>
            <div className="tablewrap"><table>
              <thead><tr><th>Choice</th><th>Taken</th><th>Alternative and trade-off</th></tr></thead>
              <tbody>
                <tr><td>Hosting</td><td>Vercel</td><td>Netlify or Render as a backup URL if a network blocks vercel.app</td></tr>
                <tr><td>Agent framework</td><td>Plain TypeScript tool loop</td><td>LangGraph or similar gives graphs and tracing, at the cost of weight and a learning curve for a 5-day MVP</td></tr>
                <tr><td>Who decides</td><td>Code for verdicts, LLM for diagnosis and messages</td><td>A fully LLM-driven pipeline is simpler to describe but harder to make reliable, fast and auditable</td></tr>
                <tr><td>Storage</td><td>Browser, per user</td><td>Supabase Postgres for shared decisions and audit across users (next step)</td></tr>
              </tbody>
            </table></div>
          </div>
        </div>
      </main>
    </>
  )
}
