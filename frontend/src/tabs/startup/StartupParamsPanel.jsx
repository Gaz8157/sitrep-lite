import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, APIError } from "../../api/index.js"
import { Badge, Card, Toggle } from "../../components/index.js"

// Controlled <input type=number> overwrites mid-typing "-" with "0" because
// Number("")=0. Local text state lets "-" survive until digits arrive.
function IntInput({ value, onChange, min, max, disabled, className, style }) {
  const [text, setText] = useState(value == null ? "" : String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value == null ? "" : String(value))
  }, [value, focused])
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const n = parseInt(text, 10)
        if (Number.isNaN(n)) {
          setText(value == null ? "" : String(value))
          return
        }
        let clamped = n
        if (min !== undefined && min !== null && clamped < min) clamped = min
        if (max !== undefined && max !== null && clamped > max) clamped = max
        setText(String(clamped))
        if (clamped !== value) onChange(clamped)
      }}
      onChange={e => {
        const v = e.target.value
        if (v === "" || v === "-") { setText(v); return }
        if (!/^-?\d+$/.test(v)) return
        setText(v)
        onChange(parseInt(v, 10))
      }}
      className={className}
      style={style}
    />
  )
}

// Ported from v1's Startup tab Params view (lines 425-470).
// Single source of truth for shape is the backend catalog at
// /api/servers/:id/startup-params. Edits are lifted into the parent
// Startup.jsx so the Save & Apply button can live in the sub-tab header.
export default function StartupParamsPanel({
  instance,
  toast,
  edits,
  setEdit,
  customLaunchParams,
  setCustomLaunchParams,
  onLoaded,
  isDemo,
}) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (id == null) return
    setLoading(true)
    apiGet(`/api/servers/${id}/startup-params`)
      .then(r => {
        if (cancelled) return
        setData(r)
        if (!category && r?.categories?.length) setCategory(r.categories[0])
        if (r?.customLaunchParams != null) setCustomLaunchParams(r.customLaunchParams)
        onLoaded?.(r)
      })
      .catch(e => {
        if (cancelled) return
        toast?.(e instanceof APIError ? e.message : String(e), "danger")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: C.textMuted, fontSize: sz.base }}>
        Loading startup params...
      </div>
    )
  }
  if (!data) {
    return (
      <Card className="p-6">
        <div style={{ color: C.textMuted, fontSize: sz.base }}>
          Could not load startup params.
        </div>
      </Card>
    )
  }

  const params = data.params || []
  const categories = data.categories || []
  const activeCategory = category || categories[0]
  const shown = params.filter(p => p.category === activeCategory)

  const valueOf = (p) => {
    if (p.key in edits) return edits[p.key]
    if (p.active) return p.value
    return p.default != null ? p.default : (p.type === "flag" ? false : p.type === "int" ? 0 : "")
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4">
        <div style={{ color: C.textMuted, fontSize: sz.stat }}>
          Control Arma Reforger command-line flags. Changes take effect after a server restart.
          The executable path and <span className="font-mono">-config</span>/<span className="font-mono">-profile</span>
          {" "}are managed automatically.
        </div>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className="px-3 py-1.5 rounded-lg font-bold cursor-pointer"
            style={{
              background: activeCategory === cat ? C.accentBg : C.bgInput,
              color: activeCategory === cat ? C.accent : C.textDim,
              border: `1px solid ${activeCategory === cat ? C.accent + "40" : C.border}`,
              fontSize: sz.nav,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {shown.map(p => {
          const val = valueOf(p)
          const isDirty = p.key in edits
          return (
            <Card key={p.key} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold" style={{ color: C.textBright, fontSize: sz.base }}>
                      {p.label}
                    </span>
                    {p.description && (
                      <div className="relative group inline-block">
                        <span
                          className="cursor-help select-none leading-none"
                          style={{ color: C.textMuted, fontSize: sz.stat + 1 }}
                        >
                          ⓘ
                        </span>
                        <div
                          className="absolute left-0 top-full mt-1 z-[9999] hidden group-hover:block w-64 rounded-lg p-2.5 shadow-xl"
                          style={{
                            background: C.bgCard,
                            border: `1px solid ${C.border}`,
                            color: C.textDim,
                            fontSize: sz.stat,
                            lineHeight: 1.5,
                          }}
                        >
                          {p.description}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="font-mono mt-0.5" style={{ color: C.textMuted, fontSize: sz.stat }}>
                    -{p.key}
                  </div>
                </div>
                {p.active && !isDirty ? (
                  <Badge text="ACTIVE" v="default" />
                ) : isDirty ? (
                  <Badge text="MODIFIED" v="warning" />
                ) : null}
              </div>

              {p.type === "flag" && (
                <Toggle value={!!val} onChange={() => !isDemo && setEdit(p.key, !val)} />
              )}
              {p.type === "int" && (
                <div className="flex items-center gap-2">
                  <IntInput
                    value={val}
                    onChange={n => setEdit(p.key, n)}
                    min={p.min}
                    max={p.max}
                    disabled={isDemo}
                    className="flex-1 rounded-lg px-3 py-2 outline-none font-mono"
                    style={{
                      background: C.bgInput,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: sz.input,
                      opacity: isDemo ? 0.5 : 1,
                    }}
                  />
                  {p.min !== undefined && p.max !== undefined && (
                    <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                      {p.min}–{p.max}
                    </span>
                  )}
                </div>
              )}
              {p.type === "string" && (
                <input
                  value={val || ""}
                  disabled={isDemo}
                  onChange={e => setEdit(p.key, e.target.value)}
                  className="w-full rounded-lg px-3 py-2 outline-none"
                  style={{
                    background: C.bgInput,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: sz.input,
                    opacity: isDemo ? 0.5 : 1,
                  }}
                  placeholder={`e.g. ${p.default || ""}`}
                />
              )}
              {p.type === "enum" && (
                <div
                  className="flex rounded-lg overflow-hidden"
                  style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
                >
                  {(p.options || []).map(o => (
                    <button
                      key={o}
                      onClick={() => !isDemo && setEdit(p.key, o)}
                      className="flex-1 px-3 py-1.5 font-bold cursor-pointer"
                      style={{
                        background: val === o ? C.accentBg : "transparent",
                        color: val === o ? C.accent : C.textDim,
                        fontSize: sz.nav,
                        opacity: isDemo ? 0.5 : 1,
                      }}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <Card className="p-4">
        <div
          className="font-black uppercase tracking-widest mb-2"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          Additional launch parameters
        </div>
        <div
          className="mb-3 leading-relaxed"
          style={{ color: C.textMuted, fontSize: sz.stat }}
        >
          Extra flags appended to the server command line. Separate with spaces. Applied on Save &amp; Apply.
        </div>
        <input
          value={customLaunchParams}
          onChange={e => setCustomLaunchParams(e.target.value)}
          disabled={isDemo}
          placeholder="-someFlag -param value -anotherFlag"
          className="w-full rounded-lg px-3 py-2.5 outline-none font-mono"
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: sz.input,
            opacity: isDemo ? 0.5 : 1,
          }}
        />
      </Card>
    </div>
  )
}
