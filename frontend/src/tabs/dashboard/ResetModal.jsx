import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { Btn, Modal } from "../../components/index.js"
import { apiPost, apiDelete } from "../../api/index.js"

// Reset modal: Stop → (opt) Update → (opt) Remove mods → (opt) Profile reset → Start.
// "Reset everything" auto-checks Update + Remove mods + Profile reset and disables the
// individual toggles while it is on. Unchecking it restores individual control.
export function ResetModal({ open, onClose, instanceId, onComplete, toast }) {
  const { C, sz } = useT()
  const [steps, setSteps] = useState([])
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const [doUpdate, setDoUpdate] = useState(true)
  const [doRemoveMods, setDoRemoveMods] = useState(false)
  const [doResetAll, setDoResetAll] = useState(false)

  // When "Reset everything" is checked, force Update + Remove mods on.
  useEffect(() => {
    if (doResetAll) {
      setDoUpdate(true)
      setDoRemoveMods(true)
    }
  }, [doResetAll])

  const isLocked = doResetAll

  // Drive the per-step elapsed counter while a step is running.
  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(iv)
  }, [running])

  const runSequence = async () => {
    const baseSteps = [{ id: "stop", label: "Stop server", status: "pending" }]
    if (doUpdate) {
      baseSteps.push({
        id: "update",
        label: "Update via SteamCMD (may take several minutes)",
        status: "pending",
      })
    }
    if (doRemoveMods) {
      baseSteps.push({
        id: "remove_mods",
        label: "Remove all subscribed mods",
        status: "pending",
      })
    }
    if (doResetAll) {
      baseSteps.push({
        id: "reset_profile",
        label: "Wipe profile (.save + logs)",
        status: "pending",
      })
    }
    baseSteps.push({ id: "start", label: "Start server", status: "pending" })
    setSteps(baseSteps)
    setRunning(true)

    const updateStep = (id, patch) =>
      setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))

    const runStep = async (id, fn) => {
      const t0 = Date.now()
      updateStep(id, { status: "running", startedAt: t0 })
      try {
        const r = await fn()
        const dur = Math.round((Date.now() - t0) / 1000)
        updateStep(id, { status: "done", detail: r?.message || "", duration: dur })
        return true
      } catch (e) {
        const dur = Math.round((Date.now() - t0) / 1000)
        const msg = e?.message || String(e)
        updateStep(id, { status: "error", detail: msg, duration: dur })
        toast?.(msg, "danger")
        return false
      }
    }

    if (!await runStep("stop", () => apiPost(`/api/servers/${instanceId}/stop`))) {
      setRunning(false); return
    }
    if (doUpdate) {
      // force=true triggers a real steamcmd re-download/validate
      if (!await runStep("update", () => apiPost(`/api/servers/${instanceId}/install?force=true`))) {
        setRunning(false); return
      }
    }
    if (doRemoveMods) {
      if (!await runStep("remove_mods", () => apiDelete(`/api/servers/${instanceId}/mods`))) {
        setRunning(false); return
      }
    }
    if (doResetAll) {
      if (!await runStep("reset_profile", () => apiPost(`/api/servers/${instanceId}/profile/reset`))) {
        setRunning(false); return
      }
    }
    await runStep("start", () => apiPost(`/api/servers/${instanceId}/start`))
    setRunning(false)
    toast?.("Reset complete", "info")
    onComplete?.()
  }

  const close = () => {
    if (running) return
    setSteps([])
    onClose?.()
  }

  // Helper to render one of the three option rows consistently.
  const renderOption = ({ checked, onToggle, disabled, title, desc, danger }) => {
    const swatch = danger ? C.red : C.accent
    return (
      <label
        onClick={() => { if (!running && !disabled) onToggle() }}
        className="flex items-center gap-3 p-3 rounded-lg mb-2"
        style={{
          background: checked ? (danger ? C.redBg : C.accentBg) : C.bgInput,
          border: `1px solid ${checked ? swatch + "40" : C.border}`,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <div
          className="w-4 h-4 rounded flex items-center justify-center font-bold"
          style={{
            border: `2px solid ${checked ? swatch : C.textMuted}`,
            background: checked ? swatch : "transparent",
            color: checked ? "#000" : "transparent",
            fontSize: 10,
          }}
        >
          ok
        </div>
        <div className="flex-1">
          <div className="font-bold" style={{ color: checked ? C.textBright : C.textDim, fontSize: sz.base }}>
            {title}
          </div>
          <div style={{ color: C.textMuted, fontSize: sz.stat }}>
            {desc}
          </div>
        </div>
      </label>
    )
  }

  return (
    <Modal open={open} onClose={close} title="Reset Server">
      {steps.length === 0 ? (
        <>
          <div className="mb-4" style={{ color: C.textDim, fontSize: sz.base }}>
            Stop the server, run the selected optional steps, then start it again.
          </div>

          {renderOption({
            checked: doUpdate,
            onToggle: () => setDoUpdate(v => !v),
            disabled: isLocked,
            title: "Update server (SteamCMD re-download)",
            desc: <>Re-runs <code>steamcmd +app_update 1874900 validate</code> for this instance only. Takes several minutes if updates exist.</>,
          })}

          {renderOption({
            checked: doRemoveMods,
            onToggle: () => setDoRemoveMods(v => !v),
            disabled: isLocked,
            title: "Remove all mods",
            desc: "Clears every subscribed mod row and wipes this instance's Workshop download dir on disk.",
          })}

          {renderOption({
            checked: doResetAll,
            onToggle: () => setDoResetAll(v => !v),
            disabled: false,
            title: "Reset everything to default",
            desc: "Forces Update, Remove mods, AND wipes the profile (.save + logs). Effectively a factory reset for this instance.",
            danger: true,
          })}

          <div className="flex gap-2 justify-end mt-4">
            <Btn v="ghost" onClick={close}>Cancel</Btn>
            <Btn v={doResetAll ? "danger" : "info"} onClick={runSequence}>Execute</Btn>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3" style={{ color: C.textDim, fontSize: sz.base }}>
            {running ? "Reset in progress — do not close this window" : "Reset complete"}
          </div>
          <div className="space-y-1.5">
            {/* trigger re-render every tick for elapsed timer */}
            {void tick}
            {steps.map(st => {
              const col =
                st.status === "done" ? C.accent :
                st.status === "error" ? C.red :
                st.status === "running" ? C.blue :
                C.textMuted
              const icon =
                st.status === "done" ? "OK" :
                st.status === "error" ? "X" :
                st.status === "running" ? "..." :
                "·"
              const elapsed = st.status === "running" && st.startedAt
                ? Math.round((Date.now() - st.startedAt) / 1000)
                : null
              const durStr = elapsed != null ? `${elapsed}s` :
                st.duration != null ? `${st.duration}s` : ""
              return (
                <div
                  key={st.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg"
                  style={{ background: C.bgInput, border: `1px solid ${col}30` }}
                >
                  <div
                    className={st.status === "running" ? "animate-pulse" : ""}
                    style={{ color: col, fontSize: 11, fontWeight: 800, minWidth: 30, textAlign: "center" }}
                  >
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <div
                        className="font-bold flex-1"
                        style={{
                          color: st.status === "pending" ? C.textMuted : C.textBright,
                          fontSize: sz.base,
                        }}
                      >
                        {st.label}
                      </div>
                      {durStr && (
                        <div className="font-mono shrink-0" style={{ color: C.textMuted, fontSize: sz.stat }}>
                          {durStr}
                        </div>
                      )}
                    </div>
                    {st.detail && (
                      <div
                        className="font-mono break-words"
                        style={{ color: st.status === "error" ? C.red : C.textMuted, fontSize: sz.stat }}
                      >
                        {st.detail}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Btn v="ghost" onClick={close} disabled={running}>
              {running ? "Running..." : "Close"}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  )
}
