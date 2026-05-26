import { useT } from "../../ctx.jsx"
import { useFetch } from "../../hooks/index.js"
import { Btn } from "../../components/index.js"
import JoinCode from "./JoinCode.jsx"
import PortTable from "./PortTable.jsx"

export default function Network({ instance, toast }) {
  const { C, sz } = useT()
  const id = instance?.id ?? instance?.instance_id
  const { data, loading, error, refetch } = useFetch(
    id != null ? `/api/servers/${id}/network` : null,
    5000,
  )

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
          Network
        </h2>
        <Btn small v="ghost" onClick={refetch} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Btn>
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: sz.base }}
        >
          {String(error.message || error)}
        </div>
      )}

      <JoinCode
        publicIp={data?.public_ip}
        gamePort={data?.game_port}
        toast={toast}
      />

      <div
        className="rounded-xl p-5"
        style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
      >
        <div
          className="font-black uppercase tracking-widest mb-3"
          style={{ color: C.textDim, fontSize: sz.label }}
        >
          Addresses
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div>
            <div style={{ color: C.textMuted, fontSize: sz.stat }}>Bind</div>
            <div className="font-mono font-bold" style={{ color: C.text, fontSize: sz.base + 2 }}>
              {data?.bind_ip || "—"}
            </div>
          </div>
          <div>
            <div style={{ color: C.textMuted, fontSize: sz.stat }}>Public</div>
            <div className="font-mono font-bold" style={{ color: C.text, fontSize: sz.base + 2 }}>
              {data?.public_ip || "—"}
            </div>
            {!data?.public_ip && (
              <div style={{ color: C.textMuted, fontSize: sz.stat, marginTop: 2 }}>
                auto-fills after first heartbeat
              </div>
            )}
          </div>
        </div>
      </div>

      <PortTable listeners={data?.listeners || []} />

      <div
        className="rounded-lg px-3 py-2"
        style={{ background: C.blueBg, border: `1px solid ${C.blue}40`, color: C.blue, fontSize: sz.label }}
      >
        Note: Reforger uses UDP for game, A2S, and RCON. A listener is "bound" when something is
        sitting on that port — the server is running.
      </div>
    </div>
  )
}
