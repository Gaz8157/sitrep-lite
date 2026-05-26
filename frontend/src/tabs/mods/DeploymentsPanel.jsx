import { useEffect, useState } from "react"
import { useT } from "../../ctx.jsx"
import { apiGet, apiPost, apiDelete, APIError } from "../../api/index.js"
import { Btn, Card, Empty } from "../../components/index.js"

function asErr(e) {
  return e instanceof APIError ? e.message : String(e)
}

function relTime(ts) {
  if (!ts) return ""
  const epoch = typeof ts === "number" ? ts : Date.parse(ts) / 1000
  if (!epoch || isNaN(epoch)) return ""
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - epoch))
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function DeploymentsPanel({ instanceId, modCount, onApplied, toast }) {
  const { C, sz } = useT()
  const [pkgs, setPkgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pkgName, setPkgName] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await apiGet(`/api/packages`)
      const list = r?.packages || r?.items || (Array.isArray(r) ? r : [])
      setPkgs(Array.isArray(list) ? list : [])
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [])

  const save = async () => {
    const name = pkgName.trim()
    if (!name) { toast?.("Name required", "danger"); return }
    if (instanceId == null) { toast?.("No server selected", "danger"); return }
    if (busy) return
    setBusy(true)
    try {
      await apiPost(`/api/packages`, { instance_id: instanceId, name })
      toast?.(`Saved "${name}" to library`)
      setPkgName("")
      load()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const apply = async (id) => {
    if (busy || instanceId == null) return
    setBusy(true)
    try {
      const r = await apiPost(`/api/packages/${id}/apply`, { instance_id: instanceId })
      toast?.(r?.message || `Applied "${r?.name || id}"`, "info")
      onApplied?.()
      load()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  const del = async (id) => {
    if (busy) return
    setBusy(true)
    try {
      await apiDelete(`/api/packages/${id}`)
      toast?.("Deleted", "warning")
      load()
    } catch (e) {
      toast?.(asErr(e), "danger")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto space-y-3">
      <Card className="p-4">
        <div
          className="font-black uppercase tracking-wide mb-3"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          Save Current Mod List
        </div>
        <div className="flex gap-2">
          <input
            value={pkgName}
            onChange={e => setPkgName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
            placeholder={`e.g. "Milsim Standard" (${modCount} mods)`}
            className="flex-1 rounded-lg px-3 py-2 outline-none placeholder:opacity-30"
            style={{
              background: C.bgInput,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: sz.input,
            }}
          />
          <Btn onClick={save} disabled={busy || !pkgName.trim()}>Save Package</Btn>
        </div>
      </Card>

      {loading ? (
        <div style={{ color: C.textMuted, padding: 16, fontSize: sz.base }}>
          Loading packages...
        </div>
      ) : pkgs.length === 0 ? (
        <Empty
          title="No packages saved"
          sub="Save a mod list as a named package — packages are shared across all servers"
        />
      ) : (
        <div className="space-y-2">
          {pkgs.map((pkg, i) => {
            const list = pkg.mods || []
            const firstFive = list.slice(0, 5).map(m => m.name || m.mod_guid || m.modId).join(", ")
            const tail = list.length > 5 ? ` +${list.length - 5} more` : ""
            const ts = pkg.created_ts || pkg.saved_at || pkg.savedAt || pkg.created
            const source = pkg.source_instance_name
            const author = pkg.created_by
            const applied_at = pkg.last_applied_at
            const applied_to = pkg.last_applied_to_name
            const applied_by = pkg.last_applied_by
            return (
              <Card key={pkg.id || i} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold"
                      style={{ color: C.textBright, fontSize: sz.base + 1 }}
                    >
                      {pkg.name}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                        {list.length} mods
                      </span>
                      <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                        {ts ? relTime(typeof ts === "number" ? ts : Date.parse(ts) / 1000) : ""}
                      </span>
                      {(source || author) && (
                        <span style={{ color: C.textMuted, fontSize: sz.stat }}>
                          From{" "}
                          <span style={{ color: C.text, fontWeight: 700 }}>
                            {source || "unknown server"}
                          </span>
                          {" · by "}
                          <span style={{ color: C.text, fontWeight: 700 }}>
                            {author || "unknown"}
                          </span>
                        </span>
                      )}
                    </div>
                    {applied_at && (
                      <div className="mt-1" style={{ color: C.textMuted, fontSize: sz.stat - 1 }}>
                        Last applied {relTime(applied_at)}
                        {applied_to && (
                          <> to <span style={{ color: C.text, fontWeight: 700 }}>{applied_to}</span></>
                        )}
                        {applied_by && (
                          <> by <span style={{ color: C.text, fontWeight: 700 }}>{applied_by}</span></>
                        )}
                      </div>
                    )}
                    <div
                      className="font-mono mt-1 truncate"
                      style={{ color: C.textMuted, fontSize: sz.stat - 1 }}
                      title={firstFive}
                    >
                      {firstFive}{tail}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Btn small v="info" onClick={() => apply(pkg.id)} disabled={busy || instanceId == null}>
                      Apply
                    </Btn>
                    <Btn small v="danger" onClick={() => del(pkg.id)} disabled={busy}>
                      X
                    </Btn>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
