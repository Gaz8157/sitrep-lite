// Centralised path builders for the backend API.
// Keeping these here makes refactoring routes trivial and gives autocomplete in IDEs.

export const ROUTES = {
  agent: {
    info: () => `/api/agent/info`,
  },
  servers: {
    list: () => `/api/servers`,
    one: (id) => `/api/servers/${id}`,
    status: (id) => `/api/servers/${id}/status`,
    logs: (id, lines = 50) => `/api/servers/${id}/logs?lines=${lines}`,
    config: (id) => `/api/servers/${id}/config`,
    start: (id) => `/api/servers/${id}/start`,
    stop: (id) => `/api/servers/${id}/stop`,
    restart: (id) => `/api/servers/${id}/restart`,
    files: (id) => `/api/servers/${id}/files`,
    saves: (id) => `/api/servers/${id}/saves`,
    players: (id) => `/api/servers/${id}/players`,
    mods: (id) => `/api/servers/${id}/mods`,
    admins: (id) => `/api/servers/${id}/admins`,
    cpuAffinity: (id) => `/api/servers/${id}/cpu-affinity`,
  },
  system: {
    metrics: () => `/api/system/metrics`,
    cpuTopology: () => `/api/system/cpu-topology`,
  },
  ws: {
    logs: (id) => `/ws/servers/${id}/logs`,
  },
}
