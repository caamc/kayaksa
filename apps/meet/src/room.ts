// One Durable Object per meeting room: Kayak's own signalling server. It admits people (with a
// lobby for client meetings), relays WebRTC offers and answers between browsers, and carries chat,
// reactions, hand-raising, captions and host controls. Media never passes through it: audio and
// video flow directly between browsers, encrypted end to end by WebRTC (DTLS-SRTP) - except in a town
// hall, where media goes through Cloudflare Realtime (still encrypted in transit) so hundreds can join.
//
// Also here: breakout rooms (people only connect to, hear and chat with their own room), webinar Q&A,
// and the flags that tell everyone when someone's voice is changed or they appear as an avatar.
import type { MeetRole } from "../../../packages/core/src/meettoken";
import { add as addUsage, gate as usageGate, type Metric } from "./usage";

export interface Env { DB: D1Database; MAX_PEERS?: string; CF_REALTIME_APP_ID?: string; CF_REALTIME_APP_SECRET?: string; USAGE_CYCLE_DAY?: string }
interface SfuInfo { s: string; a?: string; v?: string; sc?: string[] }
interface Peer { id: string; name: string; email?: string; role: MeetRole; mic: boolean; cam: boolean; screen: number; hand: boolean; joinedAt: number; lobby: boolean; br?: string | null; vc?: boolean; av?: boolean; sfu?: SfuInfo | null; u?: { t: number; turn: number; sfu: number } }
interface Breakouts { rooms: { key: string; name: string }[]; assign: Record<string, string>; open: boolean; self: boolean; endsAt: number | null; closingAt: number | null }
interface RoomState { title: string; kind: string; lobby: boolean; locked: boolean; captions: boolean; recording: string | null; started: string | null; sfu?: boolean; br?: Breakouts | null }
interface Question { id: string; text: string; name: string | null; by: string; at: number; votes: string[]; status: "open" | "live" | "answered" | "dismissed"; answer?: string | null }

const LIMIT = 12;      // people in one peer-to-peer meeting before quality suffers
const SFU_LIMIT = 500; // a town hall on Cloudflare Realtime
const CLOSE_GRACE = 30_000; // breakout rooms close 30 seconds after the host asks

export class Room {
  private st: DurableObjectState;
  private env: Env;
  private room: RoomState | null = null;
  private meetingId = "";
  private qa: Question[] = [];
  private pend: Partial<Record<Metric, number>> = {};
  private pendAt = 0;
  private stopped = { turn: false, sfu: false };

  constructor(state: DurableObjectState, env: Env) {
    this.st = state;
    this.env = env;
    this.st.blockConcurrencyWhile(async () => {
      this.room = (await this.st.storage.get<RoomState>("room")) || null;
      this.meetingId = (await this.st.storage.get<string>("id")) || "";
      this.qa = (await this.st.storage.get<Question[]>("qa")) || [];
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
  private pub(p: Peer) { return { id: p.id, name: p.name, role: p.role, mic: p.mic, cam: p.cam, screen: p.screen, hand: p.hand, br: p.br || null, vc: !!p.vc, av: !!p.av, sfu: p.sfu || null }; }
  private sfuReady() { return !!(this.env.CF_REALTIME_APP_ID && this.env.CF_REALTIME_APP_SECRET); }
  private limit() { return this.room?.sfu ? SFU_LIMIT : LIMIT; }
  /** The people someone can see and hear: everyone, or only their own breakout room while rooms are open. */
  private sameGroup(a: Peer, b: Peer) { return !this.room?.br?.open || (a.br || null) === (b.br || null); }
  private group(me: Peer, msg: unknown, exceptSelf = false) { for (const { ws, p } of this.peers()) if (!p.lobby && this.sameGroup(me, p) && !(exceptSelf && p.id === me.id)) this.send(ws, msg); }
  private qaPub() { return this.qa.map((q) => ({ id: q.id, text: q.text, name: q.name, at: q.at, votes: q.votes.length, voters: q.votes, status: q.status, answer: q.answer || null, mine: q.by })); }
  private async qaSave() { await this.st.storage.put("qa", this.qa); this.broadcast({ t: "qa", list: this.qaPub() }); }
  private brPub() { const b = this.room?.br; return b ? { rooms: b.rooms, assign: b.assign, open: b.open, self: b.self, endsAt: b.endsAt, closingAt: b.closingAt } : null; }
  private setBr(x: { ws: WebSocket; p: Peer }, key: string | null) { x.p.br = key; x.ws.serializeAttachment(x.p); this.broadcast({ t: "peer", peer: this.pub(x.p) }); }
  private async brTell() { await this.save(); this.broadcast({ t: "breakouts", br: this.brPub() }); }
  private async closeBreakouts() {
    const b = this.room?.br; if (!b) return;
    b.open = false; b.closingAt = null; b.endsAt = null;
    for (const x of this.peers()) if (x.p.br) this.setBr(x, null);
    await this.brTell();
  }
  async alarm() {
    const b = this.room?.br; if (!b?.open) return;
    const now = Date.now();
    if (b.closingAt && b.closingAt <= now + 500) return this.closeBreakouts();
    if (b.endsAt && b.endsAt <= now + 500 && !b.closingAt) { b.closingAt = now + CLOSE_GRACE; await this.st.storage.setAlarm(b.closingAt); await this.brTell(); return; }
    const next = Math.min(b.closingAt || Infinity, b.endsAt || Infinity);
    if (next < Infinity) await this.st.storage.setAlarm(next);
  }
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
    // A town hall runs on Cloudflare Realtime when it is configured; decided when the room is empty.
    if (!this.peers().some((x) => !x.p.lobby)) {
      const sfu = this.room.kind === "townhall" && this.sfuReady();
      if (this.room.sfu !== sfu) { this.room.sfu = sfu; await this.save(); }
    }
    const live = this.peers().filter((x) => !x.p.lobby);
    const [client, server] = Object.values(new WebSocketPair());
    const name = String(claims.n || u.searchParams.get("name") || "Guest").trim().slice(0, 60) || "Guest";
    const role: MeetRole = claims.role;
    const hostHere = this.hosts().length > 0;
    // Guests wait in the lobby when it is on, when the room is locked, or when no host has arrived yet.
    const lobby = role === "guest" && (this.room.lobby || this.room.locked || !hostHere);
    if (!lobby && live.length >= this.limit() && role !== "host") {
      this.st.acceptWebSocket(server);
      this.send(server, { t: "full", limit: this.limit(), townhall: this.room.kind === "townhall" });
      server.close(4001, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    // Monthly Cloudflare Realtime limits: no new town-hall participants once a limit is reached.
    if (this.room.sfu && !lobby && !(await usageGate(this.env)).sfu) {
      this.st.acceptWebSocket(server);
      this.send(server, { t: "capped", what: "townhall" });
      server.close(4005, "capped");
      return new Response(null, { status: 101, webSocket: client });
    }
    const p: Peer = { id: crypto.randomUUID().slice(0, 8), name, email: claims.e, role, mic: true, cam: true, screen: 0, hand: false, joinedAt: Date.now(), lobby, u: { t: Date.now(), turn: 0, sfu: 0 } };
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
    this.send(ws, { t: "welcome", you: this.pub(p), peers: others, room: this.room, qa: this.qaPub(), br: this.brPub() });
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
    if (m.t === "ping") { if (!me.lobby && this.room?.sfu) await this.meter(ws, me); return this.send(ws, { t: "pong" }); }
    if (me.lobby) return; // people in the lobby can only wait
    if (m.t === "usage") return this.meter(ws, me, m);
    const isHost = me.role === "host";
    const target = (id: string) => this.peers().find((x) => x.p.id === id);
    switch (m.t) {
      case "signal": {
        const to = target(String(m.to));
        if (to && !to.p.lobby && this.sameGroup(me, to.p)) this.send(to.ws, { t: "signal", from: me.id, data: m.data });
        break;
      }
      case "state": {
        for (const k of ["mic", "cam", "hand", "vc", "av"] as const) if (typeof m[k] === "boolean") me[k] = m[k];
        // Town hall: the Cloudflare Realtime session and track names this person publishes.
        if (this.room!.sfu && m.sfu && typeof m.sfu === "object") {
          const nm = (v: unknown) => (typeof v === "string" && /^[\w:-]{1,80}$/.test(v) ? v : undefined);
          const sc = Array.isArray(m.sfu.sc) ? m.sfu.sc.map(nm).filter(Boolean).slice(0, 4) as string[] : [];
          if (nm(m.sfu.s)) me.sfu = { s: nm(m.sfu.s)!, a: nm(m.sfu.a), v: nm(m.sfu.v), sc };
        }
        // Screens: a count per person (older clients send true/false). At most 4 across the whole room.
        if (typeof m.screen === "boolean" || typeof m.screen === "number") {
          const want = Math.max(0, Math.min(4, Number(m.screen) | 0));
          const others = this.peers().filter((x) => x.p.id !== me.id && !x.p.lobby).reduce((a, x) => a + (Number(x.p.screen) || 0), 0);
          if (others + want > 4) { this.send(ws, { t: "screenFull", limit: 4 }); me.screen = Math.max(0, 4 - others); }
          else me.screen = want;
        }
        ws.serializeAttachment(me);
        this.broadcast({ t: "peer", peer: this.pub(me) }, me.id);
        break;
      }
      case "chat": {
        const text = String(m.text || "").trim().slice(0, 2000);
        if (text) this.group(me, { t: "chat", from: me.id, name: me.name, text, at: Date.now(), to: m.to || null, br: me.br || null });
        break;
      }
      case "react": {
        const e = String(m.e || "");
        if (["👍", "👏", "🎉", "❤️", "😂", "🙏", "✋"].includes(e)) this.group(me, { t: "react", from: me.id, e });
        break;
      }
      case "caption": {
        if (!this.room!.captions) break;
        const text = String(m.text || "").trim().slice(0, 1000);
        if (!text) break;
        const en = m.en ? String(m.en).trim().slice(0, 2000) : null;
        const lang = m.lang ? String(m.lang).slice(0, 8) : null;
        const conf = typeof m.conf === "number" && m.conf >= 0 && m.conf <= 1 ? Math.round(m.conf * 1000) / 1000 : null;
        this.group(me, { t: "caption", from: me.id, name: me.name, text, en, lang, conf, at: Date.now() });
        const room = me.br ? this.room!.br?.rooms.find((r) => r.key === me.br)?.name || me.br : null;
        await this.env.DB.prepare("INSERT INTO transcript (meeting_id, at, speaker, text, text_en, lang, conf, room) VALUES (?,?,?,?,?,?,?,?)").bind(this.meetingId, new Date().toISOString(), me.name, text, en, lang, conf, room).run();
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

      // ---- webinar Q&A: anyone asks (optionally anonymously), everyone upvotes, hosts answer
      case "qaAsk": {
        const text = String(m.text || "").trim().slice(0, 500);
        if (!text || this.qa.length >= 500) break;
        if (this.qa.filter((q) => q.by === me.id && Date.now() - q.at < 60_000).length >= 3) { this.send(ws, { t: "toast", text: "You can ask up to 3 questions a minute." }); break; }
        this.qa.push({ id: crypto.randomUUID().slice(0, 8), text, name: m.anon ? null : me.name, by: me.id, at: Date.now(), votes: [], status: "open" });
        await this.qaSave();
        break;
      }
      case "qaVote": {
        const q = this.qa.find((x) => x.id === m.id); if (!q || q.by === me.id) break;
        q.votes = q.votes.includes(me.id) ? q.votes.filter((v) => v !== me.id) : [...q.votes, me.id];
        await this.qaSave();
        break;
      }
      case "qaMark": {
        const q = this.qa.find((x) => x.id === m.id); if (!q) break;
        if (m.status === "deleted") { if (isHost || (q.by === me.id && q.status === "open")) { this.qa = this.qa.filter((x) => x !== q); await this.qaSave(); } break; }
        if (!isHost || !["open", "live", "answered", "dismissed"].includes(m.status)) break;
        if (m.status === "live") for (const x of this.qa) if (x.status === "live") x.status = "answered";
        q.status = m.status;
        if (typeof m.answer === "string") q.answer = m.answer.trim().slice(0, 1000) || null;
        await this.qaSave();
        break;
      }

      // ---- breakout rooms (host)
      case "brSet": {
        if (!isHost) break;
        const names: string[] = Array.isArray(m.rooms) ? m.rooms.map((n: unknown) => String(n || "").trim().slice(0, 40)).filter(Boolean).slice(0, 20) : [];
        if (!names.length) { if (this.room!.br?.open) await this.closeBreakouts(); this.room!.br = null; await this.brTell(); break; }
        const prev = this.room!.br;
        const rooms = names.map((name, i) => ({ key: "b" + (i + 1), name }));
        const assign: Record<string, string> = {};
        const live = new Set(this.peers().map((x) => x.p.id));
        for (const [pid, key] of Object.entries(m.assign || {})) if (live.has(pid) && rooms.some((r) => r.key === key)) assign[pid] = String(key);
        const minutes = Number(m.minutes) > 0 ? Math.min(240, Number(m.minutes)) : null;
        this.room!.br = { rooms, assign, open: !!prev?.open, self: !!m.self, endsAt: prev?.open ? prev.endsAt : null, closingAt: prev?.closingAt || null, ...(minutes ? { minutes } : {}) } as Breakouts;
        if (prev?.open) for (const x of this.peers()) if (!x.p.lobby && x.p.role !== "host" && (assign[x.p.id] || null) !== (x.p.br || null)) this.setBr(x, assign[x.p.id] || null);
        await this.brTell();
        break;
      }
      case "brOpen": {
        const b = this.room!.br; if (!isHost || !b || b.open) break;
        b.open = true; b.closingAt = null;
        const minutes = Number(m.minutes) > 0 ? Math.min(240, Number(m.minutes)) : 0;
        b.endsAt = minutes ? Date.now() + minutes * 60_000 : null;
        for (const x of this.peers()) if (!x.p.lobby && x.p.role !== "host" && b.assign[x.p.id]) this.setBr(x, b.assign[x.p.id]);
        if (b.endsAt) await this.st.storage.setAlarm(b.endsAt);
        await this.brTell();
        break;
      }
      case "brClose": {
        const b = this.room!.br; if (!isHost || !b?.open) break;
        if (m.now) { await this.closeBreakouts(); break; }
        b.closingAt = Date.now() + CLOSE_GRACE;
        await this.st.storage.setAlarm(b.closingAt);
        await this.brTell();
        break;
      }
      case "brMove": { // the host moves someone (or themself); with self-select on, people pick their own room
        const b = this.room!.br; if (!b?.open) break;
        const who = target(String(m.id || me.id)); if (!who) break;
        const key = m.key && b.rooms.some((r) => r.key === m.key) ? String(m.key) : null;
        if (!isHost && !(b.self && who.p.id === me.id)) break;
        if (who.p.role === "host" && who.p.id !== me.id) break;
        b.assign[who.p.id] = key || "";
        this.setBr(who, key);
        await this.save();
        break;
      }
      case "brMsg": { if (isHost) this.broadcast({ t: "brMsg", by: me.name, text: String(m.text || "").trim().slice(0, 500) }); break; }
      case "brHelp": {
        const room = this.room!.br?.rooms.find((r) => r.key === me.br);
        for (const h of this.hosts()) this.send(h.ws, { t: "brHelp", id: me.id, name: me.name, room: room?.name || "the main room", key: me.br || null });
        this.send(ws, { t: "toast", text: "The host has been asked to join your room." });
        break;
      }
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
    if (this.room) { this.room.started = null; this.room.recording = null; this.room.captions = false; this.room.locked = false; this.room.br = null; await this.save(); }
    this.qa = []; await this.st.storage.put("qa", []);
  }

  async webSocketClose(ws: WebSocket) { await this.leave(ws); }
  async webSocketError(ws: WebSocket) { await this.leave(ws); }

  // ---- Cloudflare Realtime metering. Each browser reports the bytes it received through the TURN relay and
  // the SFU (cumulative, every 20 s); participant minutes are timed here, on the server. For the SFU, the bytes
  // counted are never less than an estimate from the minutes and the video on show, so a browser that stops
  // reporting can't hide usage.
  private async meter(ws: WebSocket, me: Peer, m?: any) {
    const now = Date.now();
    const u = me.u || { t: now, turn: 0, sfu: 0 };
    const mins = Math.max(0, Math.min(10, (now - u.t) / 60000));
    const cap = (v: unknown, last: number) => { const x = Number(v); return Number.isFinite(x) && x >= last ? Math.min(x - last, 4e9) : 0; };
    const turnD = m ? cap(m.turn, u.turn) : 0, sfuD = m ? cap(m.sfu, u.sfu) : 0;
    if (m) { if (Number(m.turn) >= u.turn) u.turn = Number(m.turn) || u.turn; if (Number(m.sfu) >= u.sfu) u.sfu = Number(m.sfu) || u.sfu; }
    u.t = now; me.u = u; ws.serializeAttachment(me);
    const add = (k: Metric, v: number) => { if (v > 0) this.pend[k] = (this.pend[k] || 0) + v; };
    add("bytes", turnD);
    if (this.room?.sfu) {
      const video = !!(me.cam && me.sfu?.v);
      add(video ? "av_min" : "audio_min", mins);
      const vids = Math.min(24, this.peers().filter((x) => x.p.id !== me.id && x.p.cam && x.p.sfu?.v).length);
      add("bytes", Math.max(sfuD, mins * (vids * 2.25e6 + 0.3e6)));
    }
    if (now - this.pendAt > 10_000 || !m) await this.flushUsage();
  }
  private async flushUsage() {
    const p = this.pend; this.pend = {}; this.pendAt = Date.now();
    if (Object.keys(p).length) await addUsage(this.env, p).catch(() => {});
    const g = await usageGate(this.env).catch(() => null); if (!g) return;
    if (!g.turn && !this.stopped.turn) { this.stopped.turn = true; this.broadcast({ t: "turnStop" }); }
    if (this.room?.sfu && !g.sfu && !this.stopped.sfu) { this.stopped.sfu = true; this.broadcast({ t: "sfuStop" }); }
  }

  private async leave(ws: WebSocket) {
    const me = ws.deserializeAttachment() as Peer;
    if (!me) return;
    if (!me.lobby && (this.room?.sfu || me.u?.turn)) await this.meter(ws, me).catch(() => {});
    ws.serializeAttachment(null);
    if (me.lobby) { this.tellHostsLobby(); return; }
    this.broadcast({ t: "leave", id: me.id }, me.id);
    await this.env.DB.prepare("UPDATE attendance SET left_at = ? WHERE meeting_id = ? AND peer = ?").bind(new Date().toISOString(), this.meetingId, me.id).run();
    // When the last person leaves, the meeting is over.
    if (!this.peers().some((x) => !x.p.lobby && x.p.id !== me.id)) {
      const now = new Date().toISOString();
      await this.env.DB.prepare("UPDATE meetings SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'live'").bind(now, this.meetingId).run();
      if (this.room) { this.room.started = null; this.room.recording = null; this.room.captions = false; this.room.locked = false; this.room.br = null; await this.save(); }
      this.qa = []; await this.st.storage.put("qa", []);
    }
  }
}
