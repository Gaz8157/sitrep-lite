// WebSocket client stub — real implementation lands in Plan H/I.
// Exposes the surface area we expect: open/close/on(event, cb).

export class WSClient {
  constructor(url) {
    this.url = url
    this.ws = null
    this.listeners = new Map()
    this._reconnectMs = 1500
    this._closed = true
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(cb)
    return () => this.listeners.get(event)?.delete(cb)
  }

  _emit(event, payload) {
    const set = this.listeners.get(event)
    if (!set) return
    for (const cb of set) {
      try { cb(payload) } catch (e) { console.error("WSClient listener error", e) }
    }
  }

  open() {
    // Stub — no-op so consumers don't accidentally connect during Plan G.
    // Plan H wires the actual WebSocket lifecycle.
    this._closed = false
  }

  send(_msg) {
    // Stub
  }

  close() {
    this._closed = true
    if (this.ws) {
      try { this.ws.close() } catch (_) {}
      this.ws = null
    }
  }
}

export function makeWS(url) {
  return new WSClient(url)
}
