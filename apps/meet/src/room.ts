// One Durable Object per meeting room: Kayak's own signalling server. It admits people (with a
// lobby for client meetings), relays WebRTC offers and answers between browsers, and carries chat,
// reactions, hand-raising, captions and host controls. Media never passes through it: audio and
// video flow directly between browsers, encrypted end to end by WebRTC (DTLS-SRTP).
import type { MeetRole } from "../../../packages/core/src/meettoken";

export interface Env { DB: D1Database; MAX_PEERS?: string }
interface Peer { id: string; name: string; email?: string; role: MeetRole; mic: boolean; cam: boolean; screen: boolean; hand: boolean; joinedAt: number; lobby: boolean }
interface RoomState { title: string; kind: string; lobby: boolean; locked: boolean; captions: boolean; recording: string | null; started: string | null }

const LIMIT = 12; // people in one peer-to-peer meeting before quality suffers

export class Room {
  private st: DurableObjectState;
  private env: Env;
  private room: RoomState | null = null;
  private meetingId = "";

  constructor(state: DurableObjectState, env: Env) {
    this.st = state;
    this.env = env;
    this.st.blockConcurrencyWhile(async () => {
      this.room = (await this.st.storage.get<RoomState>("room")) || null;
      this.meetingId = (await this.st.storage.get<string>("id")) || "";
    });
  }

  private peers(): { ws: WebSocket; p: Peer }[] {
    return this.st.getWebSockets().map((ws) => ({ ws, p: ws.deserializeAttachment() as Peer })).filter((x) => x.p);
  }
  private send(ws: WebSocket, msg: unknown) { try { ws.send(JSON.stringify(msg)); } catch {} }
  private broadcast(msg: unknown, except?: string, includeLobby = false) {
    for (const { ws, p } of this.peers()) if (p.id !== except && (includeLobby || !p.lobby)) this.send(ws, msg);
  }
  private hosts() { return this.peers().filter((x) => x.p.role === "host" && !x.p.lobby); }
  private pub(p: Peer) { return { id: p.id, name: p.name, role: p.role, mic: p.mic, cam: p.cam, screen: p.screen, hand: p.hand }; }
  private async save() { await this.st.storage.put("room", this.room); }
  private lobbyList() { return this.peers().filter((x) => x.p.lobby).map((x) => ({ id: x.p.id, name: x.p.name, email: x.p.email || null })); }
  private tellHostsLobby() { const l = this.lobbyList(); for (const h of this.hosts()) this.send(h.ws, { t: "lobby", list: l }); }

  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url);
    if (u.pathname === "/end") { await this.end("ended by the portal"); return new Response("ok"); }
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const claims = JSON.parse(req.headers.get("X-Claims") || "{}");
    const meeting = JSON.parse(req.headers.get("X-Meeting") || "{}");
    if (!this.room) {
      this.meetingId = meeting.id;
      this.room = { title: meeting.title, kind: meeting.kind, lobby: !!meeting.lobby, locked: false, captions: false, recording: null, started: null };
      await this.st.storage.put("id", this.meetingId);
      await this.save();
    }
    const live = this.peers().filter((x) => !x.p.lobby);
    const [client, server] = Object.values(new WebSocketPair());
    const name = String(claims.n || u.searchParams.get("name") || "Guest").trim().slice(0, 60) || "Guest";
    const role: MeetRole = claims.role;
    const hostHere = this.hosts().length > 0;
    // Guests wait in the lobby when it is on, when the room is locked, or when no host has arrived yet.
    const lobby = role === "guest" && (this.room.lobby || this.room.locked || !hostHere);
    if (!lobby && live.length >= LIMIT && role !== "host") {
      this.st.acceptWebSocket(server);
      this.send(server, { t: "full", limit: LIMIT });
      server.close(4001, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    const p: Peer = { id: crypto.randomUUID().slice(0, 8), name, email: claims.e, role, mic: true, cam: true, screen: false, hand: false, joinedAt: Date.now(), lobby };
    this.st.acceptWebSocket(server);
    server.serializeAttachment(p);
    if (lobby) {
      this.send(server, { t: "waiting", you: this.pub(p), title: this.room.title, hostHere });
      this.tellHostsLobby();
    } else await this.enter(server, p);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async enter(ws: WebSocket, p: Peer) {
    p.lobby = false;
    ws.serializeAttachment(p);
    const others = this.peers().filter((x) => x.p.id !== p.id && !x.p.lobby).map((x) => this.pub(x.p));
    this.send(ws, { t: "welcome", you: this.pub(p), peers: others, room: this.room });
    this.broadcast({ t: "join", peer: this.pub(p) }, p.id);
    if (p.role === "host") this.send(ws, { t: "lobby", list: this.lobbyList() });
    // A host arriving lets waiting guests know.
    if (p.role === "host") for (const x of this.peers()) if (x.p.lobby) this.send(x.ws, { t: "waiting", you: this.pub(x.p), title: this.room!.title, hostHere: true });
    const now = new Date().toISOString();
    if (!this.room!.started) {
      this.room!.started = now;
      await this.save();
      await this.env.DB.prepare("UPDATE meetings SET status = 'live', started_at = COALESCE(started_at, ?) WHERE id = ?").bind(now, this.meetingId).run();
    }
    const live = this.peers().filter((x) => !x.p.lobby).length;
    await this.env.DB.batch([
      this.env.DB.prepare("INSERT INTO attendance (meeting_id, peer, name, email, role, joined_at) VALUES (?,?,?,?,?,?)").bind(this.meetingId, p.id, p.name, p.email || null, p.role, now),
      this.env.DB.prepare("UPDATE meetings SET peak = MAX(peak, ?) WHERE id = ?").bind(live, this.meetingId),
    ]);
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > 64_000) return;
    let m: any;
    try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment() as Peer;
    if (!me) return;
    if (m.t === "ping") return this.send(ws, { t: "pong" });
    if (me.lobby) return; // people in the lobby can only wait
    const isHost = me.role === "host";
    const target = (id: string) => this.peers().find((x) => x.p.id === id);
    switch (m.t) {
      case "signal": {
        const to = target(String(m.to));
        if (to && !to.p.lobby) this.send(to.ws, { t: "signal", from: me.id, data: m.data });
        break;
      }
      case "state": {
        for (const k of ["mic", "cam", "screen", "hand"] as const) if (typeof m[k] === "boolean") me[k] = m[k];
        ws.serializeAttachment(me);
        this.broadcast({ t: "peer", peer: this.pub(me) }, me.id);
        break;
      }
      case "chat": {
        const text = String(m.text || "").trim().slice(0, 2000);
        if (text) this.broadcast({ t: "chat", from: me.id, name: me.name, text, at: Date.now(), to: m.to || null }, undefined);
        break;
      }
      case "react": {
        const e = String(m.e || "");
        if (["👍", "👏", "🎉", "❤️", "😂", "🙏", "✋"].includes(e)) this.broadcast({ t: "react", from: me.id, e });
        break;
      }
      case "caption": {
        if (!this.room!.captions) break;
        const text = String(m.text || "").trim().slice(0, 1000);
        if (!text) break;
        this.broadcast({ t: "caption", from: me.id, name: me.name, text, at: Date.now() });
        await this.env.DB.prepare("INSERT INTO transcript (meeting_id, at, speaker, text) VALUES (?,?,?,?)").bind(this.meetingId, new Date().toISOString(), me.name, text).run();
        break;
      }
      case "admit": case "deny": {
        if (!isHost) break;
        const g = target(String(m.id));
        if (!g || !g.p.lobby) break;
        if (m.t === "admit") await this.enter(g.ws, g.p);
        else { this.send(g.ws, { t: "denied" }); g.ws.close(4003, "denied"); }
        this.tellHostsLobby();
        break;
      }
      case "admitAll": {
        if (!isHost) break;
        for (const g of this.peers().filter((x) => x.p.lobby)) await this.enter(g.ws, g.p);
        this.tellHostsLobby();
        break;
      }
      case "mute": { if (isHost) { const g = target(String(m.id)); if (g) this.send(g.ws, { t: "muteRequest", by: me.name }); } break; }
      case "muteAll": { if (isHost) this.broadcast({ t: "muteRequest", by: me.name }, me.id); break; }
      case "remove": {
        if (!isHost) break;
        const g = target(String(m.id));
        if (g && g.p.role !== "host") { this.send(g.ws, { t: "removed" }); g.ws.close(4004, "removed"); }
        break;
      }
      case "host": { // make someone a co-host
        if (!isHost) break;
        const g = target(String(m.id));
        if (g && g.p.role !== "guest") { g.p.role = "host"; g.ws.serializeAttachment(g.p); this.broadcast({ t: "peer", peer: this.pub(g.p) }); this.send(g.ws, { t: "lobby", list: this.lobbyList() }); }
        break;
      }
      case "room": {
        if (!isHost) break;
        if (typeof m.locked === "boolean") this.room!.locked = m.locked;
        if (typeof m.lobby === "boolean") this.room!.lobby = m.lobby;
        if (typeof m.captions === "boolean") this.room!.captions = m.captions;
        if ("recording" in m) this.room!.recording = m.recording ? me.name : null;
        await this.save();
        this.broadcast({ t: "room", room: this.room, by: me.name }, undefined, true);
        break;
      }
      case "end": { if (isHost) await this.end(me.name); break; }
    }
  }

  private async end(by: string) {
    this.broadcast({ t: "ended", by }, undefined, true);
    for (const { ws } of this.peers()) try { ws.close(4000, "ended"); } catch {}
    const now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE meetings SET status = 'ended', ended_at = ? WHERE id = ?").bind(now, this.meetingId),
      this.env.DB.prepare("UPDATE attendance SET left_at = ? WHERE meeting_id = ? AND left_at IS NULL").bind(now, this.meetingId),
    ]);
    if (this.room) { this.room.started = null; this.room.recording = null; this.room.captions = false; this.room.locked = false; await this.save(); }
  }

  async webSocketClose(ws: WebSocket) { await this.leave(ws); }
  async webSocketError(ws: WebSocket) { await this.leave(ws); }

  private async leave(ws: WebSocket) {
    const me = ws.deserializeAttachment() as Peer;
    if (!me) return;
    ws.serializeAttachment(null);
    if (me.lobby) { this.tellHostsLobby(); return; }
    this.broadcast({ t: "leave", id: me.id }, me.id);
    await this.env.DB.prepare("UPDATE attendance SET left_at = ? WHERE meeting_id = ? AND peer = ?").bind(new Date().toISOString(), this.meetingId, me.id).run();
    // When the last person leaves, the meeting is over.
    if (!this.peers().some((x) => !x.p.lobby && x.p.id !== me.id)) {
      const now = new Date().toISOString();
      await this.env.DB.prepare("UPDATE meetings SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'live'").bind(now, this.meetingId).run();
      if (this.room) { this.room.started = null; this.room.recording = null; this.room.captions = false; this.room.locked = false; await this.save(); }
    }
  }
}
