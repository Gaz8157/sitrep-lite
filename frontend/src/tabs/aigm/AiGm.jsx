import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn } from "../../components/index.js"
import { apiGet } from "../../api/index.js"

// Per the master spec section 3: AI GM is explicitly not built in this rebuild.
// This tab only renders when `/api/aigm/status` returns `{enabled: true}`, which
// requires the future sitrep-aigm.service to be installed and running. The view
// below is the operator UI for that future state — until then, App.jsx filters
// this tab out entirely.
export default function AiGm({ instance, toast }) {
  const { C, sz } = useT()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    const fetchStatus = async () => {
      try {
        const d = await apiGet("/api/aigm/status")
        if (alive) { setStatus(d); setError(null) }
      } catch (e) {
        if (alive) setError(e?.message || String(e))
      }
    }
    fetchStatus()
    const iv = setInterval(fetchStatus, 5000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  const enabled = !!status?.enabled
  const running = !!status?.running

  return (
    <div className="p-6 space-y-4">
      <IsolationBanner C={C} sz={sz} />

      <header>
        <h2 className="font-black" style={{ color: C.textBright, fontSize: sz.h1, letterSpacing: 1 }}>
          AI GAME MASTER
        </h2>
        <div style={{ color: C.textDim, fontSize: sz.base, marginTop: 4 }}>
          Optional autonomous director plugin. Runs as <code>sitrep-aigm@{instance?.id || "N"}.service</code> — a separate systemd unit.
        </div>
      </header>

      {!enabled && <NotInstalledCard C={C} sz={sz} />}
      {enabled && <ServiceStatusCard C={C} sz={sz} status={status} running={running} />}
      {enabled && <AuthorityCard C={C} sz={sz} />}
      {enabled && running && <ActionsCard C={C} sz={sz} />}
      {enabled && running && <BudgetCard C={C} sz={sz} status={status} />}

      {error && (
        <div style={{ color: C.textMuted, fontSize: sz.stat }}>
          status probe error: <code>{error}</code>
        </div>
      )}
    </div>
  )
}

function IsolationBanner({ C, sz }) {
  return (
    <div
      className="p-3 rounded-lg flex items-start gap-3"
      style={{ background: C.accentBg, border: `1px solid ${C.accent}40` }}
    >
      <div style={{ color: C.accent, fontSize: sz.base, fontWeight: 800, lineHeight: "1.6em" }}>!</div>
      <div>
        <div className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
          Zero-footprint isolation
        </div>
        <div style={{ color: C.textDim, fontSize: sz.stat, marginTop: 2 }}>
          The AI GM runs in its own systemd unit. Stopping it leaves zero residual effect on the
          game server. It mutates state only through the audited Agent socket — same chokepoint as
          the panel — and it defers to the human player GM at all times.
        </div>
      </div>
    </div>
  )
}

function NotInstalledCard({ C, sz }) {
  return (
    <div
      className="p-5 rounded-lg"
      style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
    >
      <div className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
        Not installed
      </div>
      <div style={{ color: C.textDim, fontSize: sz.stat, marginTop: 8, lineHeight: "1.6em" }}>
        AI GM is intentionally not built in the current rebuild. The architecture reserves a clean
        slot for it as a future plugin, but no AI GM code runs on this host. This tab becomes
        active once <code style={{ color: C.textBright }}>sitrep-aigm@&lt;id&gt;.service</code> is
        installed and reports <code style={{ color: C.textBright }}>enabled: true</code>.
      </div>
      <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 12 }}>
        Design constraints when it is built:
      </div>
      <ul style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 4, paddingLeft: 20, lineHeight: "1.8em" }}>
        <li>Separate process, separate systemd unit, separate venv.</li>
        <li>Mutations only through the typed Agent client — no direct file or subprocess access.</li>
        <li>Player GM activity is checked before any AI action fires; player GM always wins.</li>
        <li>Hard per-instance token and action budgets, enforced at the Agent.</li>
        <li>Every AI decision logged to the JSONL audit trail with prompt/response.</li>
      </ul>
    </div>
  )
}

function ServiceStatusCard({ C, sz, status, running }) {
  const color = running ? C.green : C.textMuted
  return (
    <div
      className="p-4 rounded-lg"
      style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-between">
        <div className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
          Service status
        </div>
        <div style={{ color, fontSize: sz.stat, fontWeight: 700 }}>
          {running ? "RUNNING" : "STOPPED"}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3" style={{ fontSize: sz.stat }}>
        <Field C={C} label="PID" value={status?.pid || "—"} />
        <Field C={C} label="Uptime" value={status?.uptime_human || "—"} />
        <Field C={C} label="Model" value={status?.model || "—"} />
        <Field C={C} label="Provider" value={status?.provider || "—"} />
      </div>
    </div>
  )
}

function AuthorityCard({ C, sz }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
      <div className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
        Player GM authority
      </div>
      <div style={{ color: C.textDim, fontSize: sz.stat, marginTop: 6 }}>
        Any time a human is in the GM slot, the AI is in observe-only mode. Queued actions wait
        until the human exits the role or explicitly hands off. This is enforced in the Agent's
        <code> budget_guard</code> — the AI cannot bypass it.
      </div>
    </div>
  )
}

function ActionsCard({ C, sz }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
      <div className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
        Recent actions
      </div>
      <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 8 }}>
        Action feed appears here once the service is wired up.
      </div>
    </div>
  )
}

function BudgetCard({ C, sz, status }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: C.bgInput, border: `1px solid ${C.border}` }}>
      <div className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
        Budget
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3" style={{ fontSize: sz.stat }}>
        <Field C={C} label="Tokens / min" value={status?.budget?.tokens_per_min || "—"} />
        <Field C={C} label="Actions / hour" value={status?.budget?.actions_per_hour || "—"} />
      </div>
    </div>
  )
}

function Field({ C, label, value }) {
  return (
    <div>
      <div style={{ color: C.textMuted }}>{label}</div>
      <div style={{ color: C.textBright, fontFamily: "monospace", marginTop: 2 }}>{value}</div>
    </div>
  )
}
