import { useState, useEffect, useCallback } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiDelete, APIError } from "../../api/index.js"
import { VANILLA_SCENARIOS, formatMission } from "../../constants.js"
import { Badge, Btn, Input, Modal } from "../../components/index.js"
import { useAuth } from "../../auth/useAuth.jsx"
import UserChip from "../../auth/UserChip.jsx"
import { RenameModal } from "./RenameModal.jsx"
import StorageStrip from "./StorageStrip.jsx"

// ── New-server provision card ────────────────────────────────────────────────
function NewServerCard({ onCreated, toast }) {
  const { C, sz } = useT()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: "",            // shown in Reforger server browser (config.json game.name)
    display_name: "",    // panel-side label (sidebar, dashboard chip)
    scenario_id: VANILLA_SCENARIOS[0].id,
  })
  // While true, editing Server name copies into Instance name. The mirror
  // disconnects as soon as the operator types in the Instance name field.
  const [instanceNameMirrors, setInstanceNameMirrors] = useState(true)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionLog, setProvisionLog] = useState("")

  const reset = () => {
    setOpen(false)
    setStep(1)
    setForm({ name: "", display_name: "", scenario_id: VANILLA_SCENARIOS[0].id })
    setInstanceNameMirrors(true)
    setProvisioning(false)
    setProvisionLog("")
  }

  const submit = async () => {
    setProvisioning(true)
    setProvisionLog("Sending provision request to agent...\n")
    try {
      // Send both names — backend defaults display_name to name when empty.
      const r = await apiPost("/api/servers", {
        name: form.name,
        display_name: form.display_name || form.name,
        scenario_id: form.scenario_id,
      })
      setProvisionLog(p => p + `Done. ${JSON.stringify(r)}\n`)
      toast("Server provisioned", "default")
      // Pass the created instance through to onCreated so the caller can refresh + select.
      onCreated(r)
      setTimeout(reset, 1500)
    } catch (e) {
      const msg = e instanceof APIError ? e.message : String(e)
      setProvisionLog(p => p + `ERROR: ${msg}\n`)
      toast(`Provision failed: ${msg}`, "danger")
      setProvisioning(false)
    }
  }

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
        style={{ background: "transparent", border: `2px dashed ${C.border}`, minHeight: 180 }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent + "60")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
      >
        <div style={{ color: C.textDim, fontSize: sz.base + 4, fontWeight: 800 }}>+ New Server</div>
        <div style={{ color: C.textMuted, fontSize: sz.stat }}>Provision a fresh Reforger instance</div>
      </div>
    )
  }

  const scenario = VANILLA_SCENARIOS.find(s => s.id === form.scenario_id)

  return (
    <Modal open={open} onClose={reset} title="New Server Instance">
      {!provisioning ? (
        <div className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label
                  className="font-bold block mb-1.5"
                  style={{ color: C.textDim, fontSize: sz.label }}
                >
                  Server name{" "}
                  <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 500 }}>
                    (shown in Reforger server browser)
                  </span>
                </label>
                <Input
                  value={form.name}
                  onChange={v => {
                    setForm(p => ({
                      ...p,
                      name: v,
                      // While the operator hasn't touched Instance name, mirror.
                      display_name: instanceNameMirrors ? v : p.display_name,
                    }))
                  }}
                  placeholder="e.g. EU PvP Server"
                />
              </div>
              <div>
                <label
                  className="font-bold block mb-1.5"
                  style={{ color: C.textDim, fontSize: sz.label }}
                >
                  Instance name{" "}
                  <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 500 }}>
                    (panel-side label)
                  </span>
                </label>
                <Input
                  value={form.display_name}
                  onChange={v => {
                    setForm(p => ({ ...p, display_name: v }))
                    // Operator took manual control; stop auto-mirroring.
                    if (instanceNameMirrors) setInstanceNameMirrors(false)
                  }}
                  placeholder="e.g. Friday Night"
                />
              </div>
              <Btn
                onClick={() => form.name.trim() && setStep(2)}
                disabled={!form.name.trim()}
              >
                Next →
              </Btn>
            </>
          )}
          {step === 2 && (
            <>
              <div
                className="font-bold mb-2"
                style={{ color: C.textDim, fontSize: sz.label }}
              >
                SCENARIO
              </div>
              <div className="space-y-2" style={{ maxHeight: "50vh", overflow: "auto" }}>
                {VANILLA_SCENARIOS.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setForm(p => ({ ...p, scenario_id: s.id }))}
                    className="p-3 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: form.scenario_id === s.id ? C.accentBg : C.bgInput,
                      border: `1px solid ${form.scenario_id === s.id ? C.accent + "50" : C.border}`,
                    }}
                  >
                    <div
                      className="font-bold"
                      style={{ color: form.scenario_id === s.id ? C.accent : C.text, fontSize: sz.stat }}
                    >
                      {s.label}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
                      {s.mode}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Btn v="ghost" onClick={() => setStep(1)}>← Back</Btn>
                <Btn onClick={() => setStep(3)}>Review →</Btn>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div
                className="space-y-2 p-4 rounded-xl"
                style={{ background: C.bgInput, border: `1px solid ${C.border}` }}
              >
                {[
                  ["Server name", form.name],
                  ["Instance name", form.display_name || form.name],
                  ["Scenario", scenario ? scenario.label : form.scenario_id],
                  ["Mode", scenario ? scenario.mode : "-"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span style={{ color: C.textMuted, fontSize: sz.stat }}>{k}</span>
                    <span
                      className="font-bold text-right"
                      style={{ color: C.text, fontSize: sz.stat, maxWidth: "60%" }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Btn v="ghost" onClick={() => setStep(2)}>← Back</Btn>
                <Btn onClick={submit}>Create Server</Btn>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="font-bold mb-3" style={{ color: C.textDim, fontSize: sz.label }}>
            PROVISIONING
          </div>
          <pre
            className="rounded-xl p-4 font-mono overflow-auto"
            style={{ background: C.bgInput, color: C.accent, fontSize: sz.stat, maxHeight: 240 }}
          >
            {provisionLog}
          </pre>
        </div>
      )}
    </Modal>
  )
}

// ── Main ServerPicker ────────────────────────────────────────────────────────
export default function ServerPicker({
  authUser,
  onSelect,
  toast,
  themeName,
  setThemeName,
  textSize,
  setTextSize,
}) {
  const { C, sz } = useT()
  const { me, serverAccess } = useAuth()
  const [instances, setInstances] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingRename, setPendingRename] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const visibleInstances = (instances || []).filter(inst => {
    const id = inst.id ?? inst.instance_id
    const role = me?.role
    if (role === "owner") return true
    const override = serverAccess?.[id]
    return !!override && override !== "none"
  })

  const fetchInstances = useCallback(async () => {
    try {
      const d = await apiGet("/api/servers")
      // Backend returns { instances: [...] } but v1 used { servers: [...] }; accept both.
      const list = d.instances || d.servers || []
      setInstances(list)
      setError(null)
    } catch (e) {
      setError(e instanceof APIError ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInstances()
    // 10s is plenty for picker freshness; each tick fans out to N+1 agent
    // calls (instances_list + lifecycle_status × instance_count), so faster
    // polling adds load without user-visible value.
    const iv = setInterval(fetchInstances, 10000)
    return () => clearInterval(iv)
  }, [fetchInstances])

  const confirmDelete = async () => {
    if (!pendingDelete || deletingId != null) return
    const inst = pendingDelete
    const id = inst.id ?? inst.instance_id
    setDeletingId(id)
    try {
      await apiDelete(`/api/servers/${id}`)
      toast?.(`Deleted ${inst.display_name || inst.name}`, "warning")
      setPendingDelete(null)
      await fetchInstances()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setDeletingId(null)
    }
  }

  // After provisioning, refresh the list and try to select the new instance.
  const onCreated = async (created) => {
    try {
      const d = await apiGet("/api/servers")
      const list = d.instances || d.servers || []
      setInstances(list)
      // Best-effort: if the provision response carried an instance_id/id, jump in.
      const newId = created?.instance_id ?? created?.id ?? created?.instance?.id
      if (newId != null) {
        const match = list.find(i => (i.id ?? i.instance_id) === newId)
        if (match) onSelect(match)
      }
    } catch (e) {
      // ignore — polling will pick it up
    }
  }

  const onLogout = () => {
    // No auth in single-operator mode; logout is a no-op besides toast feedback.
    toast("Single-operator mode — no logout", "warning")
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: C.bg, color: C.text,
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
      }}
    >
      {/* Header */}
      <div
        className="px-6 h-16 flex items-center gap-4"
        style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}` }}
      >
        <span
          className="font-black tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4 }}
        >
          SITREP
        </span>
        <span style={{ color: C.textMuted, fontSize: sz.stat }}>Arma Reforger Panel</span>
        <div className="flex-1" />
        {/* Text size picker */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          {["S", "M", "L", "XL", "XXL"].map(s => (
            <button
              key={s}
              onClick={() => { setTextSize(s); localStorage.setItem("sitrep-ts", s) }}
              className="px-2.5 py-1 font-bold cursor-pointer"
              style={{
                background: textSize === s ? C.accentBg : "transparent",
                color: textSize === s ? C.accent : C.textDim,
                fontSize: 9,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <UserChip authUser={authUser} />
      </div>

      {/* Content */}
      <div className="p-8 max-w-[1200px] mx-auto">
        <div className="flex items-end gap-4 mb-6">
          <div>
            <div
              className="font-black tracking-tight mb-1"
              style={{ color: C.textBright, fontSize: sz.base + 8 }}
            >
              Choose a Server
            </div>
            {instances && (
              <div style={{ color: C.textMuted, fontSize: sz.stat }}>
                {visibleInstances.length} server{visibleInstances.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ color: C.textMuted, fontSize: sz.base }}>Loading instances…</div>
        )}

        {error && !loading && (
          <div
            className="rounded-xl p-6 mb-6"
            style={{ background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, fontSize: sz.stat }}
          >
            <div className="font-bold mb-1">Agent unreachable</div>
            <div style={{ color: C.textMuted }}>{error}</div>
          </div>
        )}

        {/* Empty state — no instances and not loading */}
        {!loading && instances && visibleInstances.length === 0 && !error && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
          >
            <div
              className="font-black mb-2"
              style={{ color: C.textBright, fontSize: sz.base + 4 }}
            >
              No instances yet
            </div>
            <div className="mb-6" style={{ color: C.textMuted, fontSize: sz.stat }}>
              The agent has no provisioned servers. Provision your first to get started.
            </div>
            <NewServerCard onCreated={onCreated} toast={toast} />
          </div>
        )}

        {/* Populated grid */}
        {!loading && instances && visibleInstances.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}
          >
            {visibleInstances.map(inst => {
              const id = inst.id ?? inst.instance_id
              const running = !!(inst.running || inst.state === "running")
              const dotColor = running ? C.accent : (inst.connection_status === "offline" ? C.red : "#eab308")
              const label = inst.display_name || inst.name
              return (
                <div
                  key={id ?? inst.name}
                  className="rounded-2xl p-6 cursor-pointer transition-all"
                  style={{
                    background: C.bgCard,
                    border: `1px solid ${running ? C.accent + "40" : C.border}`,
                  }}
                  onClick={() => onSelect(inst)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent + "80")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = running ? C.accent + "40" : C.border)}
                >
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: dotColor }}
                    />
                    <span className="font-black" style={{ color: C.textBright, fontSize: sz.base + 2 }}>
                      {label}
                    </span>
                    {inst.display_name && inst.name && inst.display_name !== inst.name && (
                      <span
                        className="font-mono"
                        style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                        title="Server browser name"
                      >
                        ({inst.name})
                      </span>
                    )}
                    {id != null && (
                      <span
                        className="px-2 py-0.5 rounded font-bold"
                        style={{
                          background: C.accentBg, color: C.accent,
                          border: `1px solid ${C.accent}30`, fontSize: sz.stat - 1,
                        }}
                      >
                        #{id}
                      </span>
                    )}
                    <div className="flex-1" />
                    {inst.port != null && (
                      <span className="font-mono font-bold" style={{ color: C.textMuted, fontSize: sz.stat }}>
                        :{inst.port}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-2 mb-1"
                    style={{ color: running ? C.accent : C.red, fontSize: sz.stat }}
                  >
                    {running ? "ONLINE" : "OFFLINE"}
                    {inst.pid && (
                      <span style={{ color: C.textMuted }}>· PID {inst.pid}</span>
                    )}
                  </div>
                  {inst.scenario_id && (
                    <div
                      className="mb-2 truncate"
                      style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                      title={inst.scenario_id}
                    >
                      {formatMission(inst.scenario_id)}
                    </div>
                  )}
                  <div onClick={e => e.stopPropagation()}>
                    <StorageStrip instanceId={id} />
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                    <Btn onClick={() => onSelect(inst)} v={running ? "default" : "ghost"}>
                      Manage →
                    </Btn>
                    <Btn
                      small
                      v="ghost"
                      onClick={() => setPendingRename(inst)}
                      title="Rename this instance's panel label"
                    >
                      Edit
                    </Btn>
                    <Btn
                      v="danger"
                      small
                      disabled={running || deletingId === id}
                      title={running ? "Stop the server before deleting" : "Delete this server entirely"}
                      onClick={() => setPendingDelete(inst)}
                    >
                      {deletingId === id ? "Deleting…" : "Delete"}
                    </Btn>
                  </div>
                </div>
              )
            })}
            {/* Provision card */}
            <NewServerCard onCreated={onCreated} toast={toast} />
          </div>
        )}
      </div>

      <RenameModal
        instance={pendingRename}
        onClose={() => setPendingRename(null)}
        toast={toast}
        onSaved={(updated) => {
          setInstances(prev => prev?.map(i => {
            const iid = i.id ?? i.instance_id
            if (iid !== updated.instance_id) return i
            return { ...i, name: updated.name, display_name: updated.display_name }
          }))
        }}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => deletingId == null && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.display_name || pendingDelete?.name || "server"}?`}
      >
        <div style={{ color: C.text, fontSize: sz.base, lineHeight: 1.5 }}>
          This removes <strong>everything</strong> for this instance: the
          systemd unit is stopped, the install directory and saves are
          wiped, the Linux user is deleted, and the server-state row is
          removed. There is no undo.
        </div>
        <div
          className="mt-3 rounded-lg px-3 py-2 font-mono"
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            color: C.textMuted,
            fontSize: sz.stat,
          }}
        >
          /opt/sitrep/instances/{pendingDelete?.id ?? pendingDelete?.instance_id}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Btn small v="ghost" onClick={() => setPendingDelete(null)} disabled={deletingId != null}>
            Cancel
          </Btn>
          <Btn v="danger" onClick={confirmDelete} disabled={deletingId != null}>
            {deletingId != null ? "Deleting…" : "Delete server"}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
