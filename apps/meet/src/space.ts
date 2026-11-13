// Kayakers spaces: one Durable Object per collaborative whiteboard or game. It relays live events
// (cursors, in-progress strokes, moves) between everyone in the space and saves the durable ones
// (finished strokes, notes, deletions, game moves and states) in its own SQLite storage, so a board
// or a game is exactly as people left it.
//
// Message types from a browser:
//   { t: "op", op }        a durable change: saved, numbered, sent to everyone (whiteboard ops, game moves)
//   { t: "live", data }    a passing event (cursor, stroke in progress): sent to the others, not saved
//   { t: "seat", seat }    take a seat in a game ("w" / "b" / "p1" … "p6"), if it is free
//   { t: "reset" }         clear the board or start a new game (the space's owner, or a seated player)
export interface SpaceEnv { DB: D1Database }
interface Who { id: string; name: string; color: string; seat?: string }
const COLORS = ["#17807E", "#EE9B1E", "#2D6A9F", "#B4472F", "#5E4B78", "#4B7A4E", "#9C630E", "#1F4B5F"];
const MAX_OPS = 25_000;

export class Space {
  private st: DurableObjectState;
  private env: SpaceEnv;
  private sql: SqlStorage;
  constructor(state: DurableObjectState, env: SpaceEnv) {
    this.st = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS ops (seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL, at INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }
  private meta(k: string): string | null { const r = this.sql.exec("SELECT v FROM meta WHERE k = ?", k).toArray()[0] as any; return r ? r.v : null; }
  private setMeta(k: string, v: string) { this.sql.exec("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, v); }
  private socks() { return this.st.getWebSockets().map((ws) => ({ ws, who: ws.deserializeAttachment() as Who })).filter((x) => x.who); }
  private send(ws: WebSocket, m: unknown) { try { ws.send(JSON.stringify(m)); } catch {} }
  private all(m: unknown, except?: string) { for (const { ws, who } of this.socks()) if (who.id !== except) this.send(ws, m); }
  private people() { return this.socks().map(({ who }) => who); }
  private seats(): Record<string, { id: string; name: string }> { try { return JSON.parse(this.meta("seats") || "{}"); } catch { return {}; } }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const m = JSON.parse(req.headers.get("X-Member") || "{}");
    const space = JSON.parse(req.headers.get("X-Space") || "{}");
    if (!m.id) return new Response("Forbidden", { status: 403 });
    if (!this.meta("id")) { this.setMeta("id", String(space.id)); this.setMeta("kind", String(space.kind)); this.setMeta("owner", String(space.created_by)); }
    const [client, server] = Object.values(new WebSocketPair());
    const used = new Set(this.people().map((p) => p.color));
    const who: Who = { id: m.id + ":" + crypto.randomUUID().slice(0, 4), name: String(m.name || "Someone").slice(0, 60), color: COLORS.find((c) => !used.has(c)) || COLORS[this.people().length % COLORS.length] };
    (who as any).member = m.id;
    this.st.acceptWebSocket(server);
    server.serializeAttachment(who);
    const ops = this.sql.exec("SELECT seq, op FROM ops ORDER BY seq").toArray().map((r: any) => ({ seq: r.seq, ...JSON.parse(r.op) }));
    this.send(server, { t: "hello", you: who, ops, seats: this.seats(), people: this.people(), owner: this.meta("owner") });
    this.all({ t: "people", people: this.people() }, who.id);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > 256_000) return;
    let m: any; try { m = JSON.parse(raw); } catch { return; }
    const who = ws.deserializeAttachment() as Who & { member: string };
    if (!who) return;
    if (m.t === "ping") return this.send(ws, { t: "pong" });
    if (m.t === "live") return this.all({ t: "live", from: who.id, name: who.name, color: who.color, data: m.data }, who.id);
    if (m.t === "op" && m.op && typeof m.op === "object") {
      const count = (this.sql.exec("SELECT COUNT(*) n FROM ops").toArray()[0] as any).n;
      if (count >= MAX_OPS) return this.send(ws, { t: "error", message: "This space is full. Start a new one." });
      const op = { ...m.op, by: who.member, byName: who.name, at: Date.now() };
      const s = JSON.stringify(op);
      if (s.length > 200_000) return;
      const seq = (this.sql.exec("INSERT INTO ops (op, at) VALUES (?, ?) RETURNING seq", s, Date.now()).toArray()[0] as any).seq;
      this.all({ t: "op", op: { seq, ...op } });
      await this.env.DB.prepare("UPDATE spaces SET updated_at = ? WHERE id = ?").bind(new Date().toISOString(), this.meta("id")).run().catch(() => {});
      return;
    }
    if (m.t === "seat") {
      const seats = this.seats();
      const k = String(m.seat || "");
      if (!/^(w|b|p[1-6])$/.test(k)) return;
      if (seats[k] && seats[k].id !== who.member) return this.send(ws, { t: "error", message: `${seats[k].name} already has that seat.` });
      for (const [s, v] of Object.entries(seats)) if (v.id === who.member && s !== k) delete seats[s];
      seats[k] = { id: who.member, name: who.name };
      this.setMeta("seats", JSON.stringify(seats));
      return this.all({ t: "seats", seats });
    }
    if (m.t === "leaveSeat") {
      const seats = this.seats();
      for (const [s, v] of Object.entries(seats)) if (v.id === who.member) delete seats[s];
      this.setMeta("seats", JSON.stringify(seats));
      return this.all({ t: "seats", seats });
    }
    if (m.t === "reset") {
      const seats = this.seats();
      const seated = Object.values(seats).some((v) => v.id === who.member);
      if (who.member !== this.meta("owner") && !seated) return this.send(ws, { t: "error", message: "Only the person who created this, or a player, can start again." });
      this.sql.exec("DELETE FROM ops");
      return this.all({ t: "reset", by: who.name });
    }
  }
  async webSocketClose(ws: WebSocket) { this.left(ws); }
  async webSocketError(ws: WebSocket) { this.left(ws); }
  private left(ws: WebSocket) {
    const who = ws.deserializeAttachment() as Who;
    ws.serializeAttachment(null);
    if (who) this.all({ t: "people", people: this.people().filter((p) => p.id !== who.id) });
  }
}
