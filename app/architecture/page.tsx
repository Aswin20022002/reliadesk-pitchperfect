import { TOOLS } from '@/lib/agentLoop'

export const metadata = { title: 'ReliaDesk architecture' }

const GUARDRAILS = [
  'Agents propose only. The verdict, thresholds, stock check and schedule are plain code.',
  'The failure mode must exist in the knowledge base; every citation must match a stored excerpt, or it is removed and flagged.',
  'A second agent checks the diagnosis against the evidence and can send it back once; unresolved concerns go to a human.',
  'If the agent disagrees with the rule-based diagnosis, the case needs human review and messages stay on the template.',
  'Messages drafted by the Comms agent are checked against the plan: asset, slot, technician, every part number, no invented parts.',
  'Tool and iteration budgets are capped, and the whole workflow has a time budget.',
  'Any provider failure falls through to the next free provider, then to the rule-based path. The desk never breaks.',
  'Low confidence, thin history or missing data always goes to a human. It never writes to a PLC or controls a machine.',
  'The agents never see simulator ground truth, so replay results are honest.',
]

export default function Architecture() {
  return (
    <>
      <section className="hero fade">
        <h1>Architecture: a human-controlled agent system, with code owning every safety-critical step.</h1>
        <p>Language models do the investigative reasoning and the writing. Deterministic code owns thresholds, stock, scheduling and permissions. A human approves every action.</p>
        <div className="tags"><span className="tag">Orchestrator state machine</span><span className="tag">Tool-calling agents</span><span className="tag">Verifier loop-back</span><span className="tag">Free LLM provider chain</span></div>
      </section>
      <main className="page">
        <h2 className="section">Orchestration, end to end</h2>
        <div className="flow">
          <div className="node code"><span className="badge code">Input</span><b>Sensor alert</b><span>Fixed-threshold trigger from the plant historian</span></div>
          <span className="arrow">→</span>
          <div className="node code"><span className="badge code">Code</span><b>Orchestrator</b><span>State machine. Loops back when evidence is missing.</span></div>
          <span className="arrow">→</span>
          <div className="node code"><span className="badge code">Code</span><b>Signal · Context · Adjudicator</b><span>Per-asset baselines, load and start-up context, outcome history, verdict</span></div>
          <span className="arrow">→</span>
          <div className="node llm"><span className="badge llm">LLM agent</span><b>Diagnosis agent</b><span>Calls tools, proposes a failure mode with citations</span></div>
          <span className="arrow">→</span>
          <div className="node llm"><span className="badge llm">LLM agent</span><b>Verifier agent</b><span>Independent check. Can send it back once.</span></div>
          <span className="arrow">→</span>
          <div className="node code"><span className="badge code">Code</span><b>Resource · Planner</b><span>SAP stock, technician roster, production window, work order</span></div>
          <span className="arrow">→</span>
          <div className="node llm"><span className="badge llm">LLM agent</span><b>Comms agent</b><span>Drafts messages, code checks them against the plan</span></div>
          <span className="arrow">→</span>
          <div className="node human"><span className="badge human">Human</span><b>Supervisor approves</b><span>One click, override, or bring back</span></div>
          <span className="arrow">→</span>
          <div className="node code"><span className="badge code">Code</span><b>Learning agent</b><span>Technician outcome tunes that asset&apos;s threshold</span></div>
        </div>
        <div className="callout"><b>Why this split.</b> Agentic reasoning is valuable where the order of steps and the evidence needed change case by case, so the model chooses tools and reads manuals. It is the wrong tool for thresholds, stock and schedules, which must be exact, fast, cheap and auditable.</div>

        <h2 className="section">Tools the Diagnosis agent can call (live from the code)</h2>
        <div className="tablewrap"><table>
          <thead><tr><th style={{ width: '26%' }}>Tool</th><th>What it does</th></tr></thead>
          <tbody>{TOOLS.map((t) => <tr key={t.function.name}><td><code>{t.function.name}</code></td><td>{t.function.description}</td></tr>)}</tbody>
        </table></div>

        <h2 className="section">Guardrails</h2>
        <div className="grid2">{GUARDRAILS.map((g, i) => <div key={i} className="step"><span className="stepn">{i + 1}</span><span>{g}</span></div>)}</div>

        <h2 className="section">Free language-model providers, with automatic failover</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Order</th><th>Provider</th><th>Why it is in the chain</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Groq</td><td>Free tier, very fast, supports tool calling. The app asks Groq for its live model list if the configured models disappear.</td></tr>
            <tr><td>2</td><td>Google AI Studio (Gemini)</td><td>Free tier. Backup when Groq is rate limited or down.</td></tr>
            <tr><td>3</td><td>OpenRouter free models</td><td>Third backup. Some free models lack tool calling, in which case they are skipped.</td></tr>
            <tr><td>4</td><td>xAI Grok</td><td>Promotional credits only, no permanent free tier, so it is optional rather than a dependency.</td></tr>
            <tr><td>5</td><td>Rule-based path</td><td>No key or all providers down: the same tools run deterministically and the desk still works.</td></tr>
          </tbody>
        </table></div>
        <p className="note">The header chip shows whether keys are set on this deployment. A diagnostic endpoint at /api/llm-check reports each provider&apos;s live status without exposing keys.</p>

        <h2 className="section">Integration path in a real plant</h2>
        <div className="grid3">
          <div className="card"><h4>Read</h4><p style={{ margin: 0 }}>Sensor historian or alert feed, CMMS or SAP PM work-order history, stores, roster and production plan, read-only.</p></div>
          <div className="card"><h4>Decide</h4><p style={{ margin: 0 }}>Verdict, evidence card, diagnosis with citations from the plant&apos;s own manuals and FMEA, constraint check.</p></div>
          <div className="card"><h4>Act</h4><p style={{ margin: 0 }}>Draft work order for one-click approval, written to the CMMS only after a human approves. Never to a PLC.</p></div>
        </div>
      </main>
    </>
  )
}
