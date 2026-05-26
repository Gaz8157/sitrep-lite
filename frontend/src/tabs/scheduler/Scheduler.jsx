import { useCallback, useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiPatch, apiDelete, APIError } from "../../api/index.js"
import { Btn, Empty } from "../../components/index.js"
import AddEditModal from "./AddEditModal.jsx"
import JobCard from "./JobCard.jsx"
import LogModal from "./LogModal.jsx"

export default function Scheduler({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [logTarget, setLogTarget] = useState(null)

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    try {
      const r = await apiGet(`/api/servers/${id}/scheduler`)
      setJobs(Array.isArray(r.jobs) ? r.jobs : [])
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const create = async (body) => {
    setBusy(true)
    try {
      await apiPost(`/api/servers/${id}/scheduler`, body)
      setShowAdd(false)
      toast?.("Job created")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const update = async (job, fields) => {
    setBusy(true)
    try {
      await apiPatch(`/api/servers/${id}/scheduler/${job.id}`, fields)
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async (body) => {
    if (!editing?.id) return
    setBusy(true)
    try {
      await apiPatch(`/api/servers/${id}/scheduler/${editing.id}`, body)
      setEditing(null)
      toast?.("Saved")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (job) => {
    if (!window.confirm(`Delete job "${job.name}"?`)) return
    setBusy(true)
    try {
      await apiDelete(`/api/servers/${id}/scheduler/${job.id}`)
      toast?.("Deleted", "warning")
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const runNow = async (job) => {
    setBusy(true)
    try {
      const r = await apiPost(`/api/servers/${id}/scheduler/${job.id}/run`)
      if (r.status === "ok") {
        toast?.(`Ran ${job.name}`)
      } else {
        toast?.(`Run failed: ${r.status}`, "danger")
      }
      await load()
    } catch (e) {
      toast?.(e instanceof APIError ? e.message : String(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  if (id == null) {
    return (
      <div style={{ padding: 24, color: C.textDim, fontSize: sz.base }}>
        No instance selected.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2
          className="font-black uppercase tracking-widest"
          style={{ color: C.textBright, fontSize: sz.base + 4, margin: 0 }}
        >
          Scheduler
          <span
            className="ml-3 px-2 py-0.5 rounded font-bold"
            style={{
              background: C.bgInput, color: C.textDim, fontSize: sz.label,
              border: `1px solid ${C.border}`,
            }}
          >
            {jobs.length}
          </span>
        </h2>
        <div className="flex gap-2">
          <Btn small v="ghost" onClick={load} disabled={loading || busy}>
            {loading ? "Loading…" : "Refresh"}
          </Btn>
          <Btn onClick={() => setShowAdd(true)} disabled={busy}>+ Add</Btn>
        </div>
      </div>

      <div
        className="rounded-lg px-3 py-2"
        style={{
          background: C.blueBg,
          border: `1px solid ${C.blue}40`,
          color: C.blue,
          fontSize: sz.label,
        }}
      >
        Times use standard 5-field cron (min hour dom mon dow) interpreted in UTC. Displayed runtimes are converted
        to your local timezone.
      </div>

      {loading && jobs.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 16, fontSize: sz.base }}>Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <Empty
          title="No scheduled jobs"
          sub="Click + Add to schedule restarts, broadcasts, or updates."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map(j => (
            <JobCard
              key={j.id}
              job={j}
              busy={busy}
              onToggle={() => update(j, { enabled: !j.enabled })}
              onEdit={() => setEditing(j)}
              onRun={() => runNow(j)}
              onDelete={() => remove(j)}
              onShowLog={() => setLogTarget(j)}
            />
          ))}
        </div>
      )}

      <AddEditModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={create}
        existing={null}
        busy={busy}
      />
      <AddEditModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        existing={editing}
        busy={busy}
      />
      <LogModal
        open={!!logTarget}
        onClose={() => setLogTarget(null)}
        instanceId={id}
        job={logTarget}
        toast={toast}
      />
    </div>
  )
}
