import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, APIError } from "../../api/index.js"
import { Btn, Card } from "../../components/index.js"

// One-stop comprehensive diagnostics view. Consumes the new
// `checks` array shape from /api/servers/:id/diagnostics, renders one card
// per check, and offers a per-check "Apply fix" button when the backend
// returned a `fix` discriminator. There's intentionally no "Fix all" — the
// fixes can kick SteamCMD, mutate config, chown files. One at a time.

const SEVERITY_RANK = { error: 0, warn: 1, info: 2, ok: 3 }

function severityTokens(C, sev) {
  switch (sev) {
    case "error": return { fg: C.red, bg: C.redBg, border: C.redBorder, icon: "X" }
    case "warn":  return { fg: C.orange, bg: C.orangeBg, border: C.orange + "30", icon: "!" }
    case "info":  return { fg: C.blue, bg: C.blueBg, border: C.blue + "30", icon: "i" }
    case "ok":
    default:      return { fg: C.accent, bg: C.accentBg, border: C.accent + "30", icon: "✓" }
  }
}

function SeverityPill({ summary, C, sz }) {
  const { ok = 0, info = 0, warn = 0, error = 0 } = summary || {}
  const segments = [
    { label: "OK", n: ok, color: C.accent },
    { label: "INFO", n: info, color: C.blue },
    { label: "WARN", n: warn, color: C.orange },
    { label: "ERROR", n: error, color: C.red },
  ]
  return (
    <div className="flex items-center gap-2">
      {segments.map(s => (
        <div
          key={s.label}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{
            background: s.n > 0 ? s.color + "18" : C.bgInput,
            border: `1px solid ${s.n > 0 ? s.color + "40" : C.border}`,
          }}
        >
          <span
            className="font-black tabular-nums"
            style={{ color: s.n > 0 ? s.color : C.textMuted, fontSize: sz.base }}
          >
            {s.n}
          </span>
          <span
            className="font-bold uppercase tracking-widest"
            style={{ color: s.n > 0 ? s.color : C.textMuted, fontSize: sz.stat - 1 }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function CheckCard({ check, onFix, busyFix, C, sz }) {
  const sev = severityTokens(C, check.severity)
  const isBusy = busyFix === check.id
  const fix = check.fix
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center font-black rounded-lg flex-shrink-0"
          style={{
            width: 28, height: 28,
            background: sev.bg,
            color: sev.fg,
            border: `1px solid ${sev.border}`,
            fontSize: sz.base,
          }}
        >
          {sev.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="font-bold"
              style={{ color: sev.fg, fontSize: sz.base }}
            >
              {check.title}
            </span>
            <span
              className="font-mono"
              style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
            >
              {check.id}
            </span>
          </div>
          {check.detail && (
            <div
              className="mt-1"
              style={{ color: C.textDim, fontSize: sz.stat, lineHeight: 1.45 }}
            >
              {check.detail}
            </div>
          )}
          {Array.isArray(check.context) && check.context.length > 0 && (
            <div
              className="mt-2 p-2.5 rounded-lg font-mono whitespace-pre-wrap"
              style={{
                background: C.bgInput,
                border: `1px solid ${C.border}`,
                color: C.textDim,
                fontSize: sz.stat - 1,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {check.context.join("\n")}
            </div>
          )}
        </div>
        {fix && (
          <div className="flex-shrink-0">
            <button
              onClick={() => onFix(check)}
              disabled={isBusy}
              className="font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: sev.bg,
                color: sev.fg,
                border: `1px solid ${sev.border}`,
                fontSize: sz.stat,
              }}
              title={fix.label}
            >
              {isBusy ? "Applying..." : (fix.label || "Apply fix")}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function DiagnosticsPanel({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id

  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyFix, setBusyFix] = useState(null)

  const load = async () => {
    if (id == null) return null
    try {
      const r = await apiGet(`/api/servers/${id}/diagnostics`)
      setDiag(r)
      return r
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load().finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const applyFix = async (check) => {
    if (!check?.fix?.id || id == null) return
    setBusyFix(check.id)
    try {
      const body = {
        check_id: check.id,
        fix_id: check.fix.id,
        payload: check.fix.payload || undefined,
      }
      const r = await apiPost(`/api/servers/${id}/diagnostics/fix`, body)
      // apply_fix returns the full check() response embedded, so we can
      // refresh the UI from its result without an extra round-trip.
      if (r && Array.isArray(r.checks)) {
        setDiag(r)
      } else {
        await load()
      }
      if (r?.message) {
        toast?.(r.message, r.ok === false ? "warn" : "success")
      }
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusyFix(null)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: C.textMuted, fontSize: sz.base }}>
        Running diagnostics...
      </div>
    )
  }

  if (!diag) {
    return (
      <Card className="p-6">
        <div style={{ color: C.textMuted, fontSize: sz.base }}>
          Could not load diagnostics.
        </div>
      </Card>
    )
  }

  const allChecks = Array.isArray(diag.checks) ? diag.checks : []
  const summary = diag.summary || { ok: 0, info: 0, warn: 0, error: 0 }
  // Diagnostics shows only things that need attention. Pass results are
  // already captured in the summary pill at the top.
  const issues = allChecks.filter(c => c.severity !== "ok")
  const ordered = [...issues]
  ordered.sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 9
    const rb = SEVERITY_RANK[b.severity] ?? 9
    return ra - rb
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <SeverityPill summary={summary} C={C} sz={sz} />
        <span style={{ color: C.textMuted, fontSize: sz.stat }}>
          {summary.ok} passing · {issues.length} need attention
          {diag.log_dir ? <> · log dir {diag.log_dir}</> : null}
        </span>
        <div className="ml-auto">
          <Btn small v="ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Btn>
        </div>
      </div>

      {ordered.length === 0 ? (
        <Card className="p-6">
          <div style={{ color: C.accent, fontSize: sz.base, fontWeight: 700 }}>
            ✓ All checks passing.
          </div>
        </Card>
      ) : (
        ordered.map(c => (
          <CheckCard
            key={c.id}
            check={c}
            onFix={applyFix}
            busyFix={busyFix}
            C={C}
            sz={sz}
          />
        ))
      )}
    </div>
  )
}
