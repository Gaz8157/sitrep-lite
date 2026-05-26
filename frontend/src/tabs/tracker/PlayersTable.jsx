import { useMemo, useState } from "react"
import { useT } from "../../ctx.jsx"

const COLUMNS = [
  { id: "name",    label: "Name",    w: 160 },
  { id: "uid",     label: "UID",     w: 90  },
  { id: "faction", label: "Faction", w: 70  },
  { id: "health",  label: "HP",      w: 50, num: true },
  { id: "weapon",  label: "Weapon",  w: 130 },
  { id: "vehicle", label: "Vehicle", w: 110 },
  { id: "squad",   label: "Squad",   w: 110 },
  { id: "status",  label: "Status",  w: 70  },
  { id: "grid",    label: "Grid",    w: 110 },
]

export default function PlayersTable({ players, selectedUid, onSelectUid }) {
  const { C, sz } = useT()
  const [sortBy, setSortBy] = useState({ col: "name", dir: 1 })

  const rows = useMemo(() => {
    const arr = [...players]
    arr.sort((a, b) => {
      const cmp = (x, y) => {
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        if (typeof x === "number" && typeof y === "number") return x - y
        return String(x).localeCompare(String(y))
      }
      let av, bv
      switch (sortBy.col) {
        case "uid":     av = a.uid || ""; bv = b.uid || ""; break
        case "faction": av = a.faction || ""; bv = b.faction || ""; break
        case "health":  av = a.health ?? -1; bv = b.health ?? -1; break
        case "weapon":  av = a.weapon || ""; bv = b.weapon || ""; break
        case "vehicle": av = a.vehicle || ""; bv = b.vehicle || ""; break
        case "squad":   av = a.squad_name || ""; bv = b.squad_name || ""; break
        case "status":  av = a.status || ""; bv = b.status || ""; break
        case "grid":    av = a.grid || ""; bv = b.grid || ""; break
        case "name":
        default:        av = a.name || ""; bv = b.name || ""; break
      }
      return cmp(av, bv) * sortBy.dir
    })
    return arr
  }, [players, sortBy])

  const setSort = (col) => {
    setSortBy(prev => {
      if (prev.col === col) return { col, dir: -prev.dir }
      return { col, dir: 1 }
    })
  }

  if (!players.length) return null

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: sz.label }}>
        <thead>
          <tr style={{ background: C.bgInput }}>
            {COLUMNS.map(col => (
              <th
                key={col.id}
                onClick={() => setSort(col.id)}
                style={{
                  textAlign: col.num ? "right" : "left",
                  padding: "8px 10px",
                  color: C.textDim,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontSize: sz.label - 1,
                  cursor: "pointer",
                  userSelect: "none",
                  borderBottom: `1px solid ${C.border}`,
                  whiteSpace: "nowrap",
                  width: col.w,
                }}
              >
                {col.label}
                {sortBy.col === col.id && (
                  <span style={{ marginLeft: 4, color: C.accent }}>
                    {sortBy.dir === 1 ? "▲" : "▼"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const selected = p.uid === selectedUid
            return (
              <tr
                key={p.uid || p.name || i}
                onClick={() => onSelectUid(selected ? null : p.uid)}
                style={{
                  background: selected ? C.accentBg : "transparent",
                  cursor: "pointer",
                  transition: "background 120ms",
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = C.bgHover }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent" }}
              >
                <Cell value={p.name || "—"} C={C} bold />
                <Cell value={(p.uid || "").slice(-8) || "—"} C={C} mono />
                <Cell value={p.faction || "—"} C={C} />
                <Cell
                  value={p.health == null ? "—" : `${Math.round(Number(p.health) * 100)}`}
                  C={C}
                  num
                />
                <Cell value={p.weapon || "—"} C={C} />
                <Cell value={p.vehicle || "—"} C={C} />
                <Cell value={p.squad_name || "—"} C={C} />
                <Cell value={p.status || "—"} C={C} status={p.status} />
                <Cell value={p.grid || "—"} C={C} mono />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ value, C, bold, mono, num, status }) {
  let color = C.text
  if (status === "alive") color = "#4ade80"
  else if (status === "dead") color = "#f87171"
  else if (status === "unspawned") color = C.textMuted
  return (
    <td
      style={{
        padding: "6px 10px",
        color,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "ui-monospace, monospace" : undefined,
        textAlign: num ? "right" : "left",
        borderBottom: `1px solid ${C.border}40`,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 220,
      }}
      title={typeof value === "string" ? value : undefined}
    >
      {value}
    </td>
  )
}
