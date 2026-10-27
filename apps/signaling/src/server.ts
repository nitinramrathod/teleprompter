import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { ClientMsg, generateCode } from "@tp/shared";

type Sess = { code: string; id: string; display: WebSocket; ctrl?: WebSocket; timer: NodeJS.Timeout };
export interface Opts { port: number; codeTtlMs?: number; maxAttempts?: number; maxSessionMs?: number }

const send = (w: WebSocket | undefined, m: object) => { if (w && w.readyState === WebSocket.OPEN) w.send(JSON.stringify(m)); };

export function startSignaling(o: Opts) {
  const ttl = o.codeTtlMs ?? 600_000, maxAttempts = o.maxAttempts ?? 5;
  const sessions = new Map<string, Sess>();
  const wss = new WebSocketServer({ port: o.port, maxPayload: 16_384 });
  const drop = (s: Sess, reason: string) => {
    clearTimeout(s.timer); sessions.delete(s.code);
    for (const w of [s.display, s.ctrl]) { send(w, { type: "closed", reason }); w?.close(); }
  };
  const hb = setInterval(() => wss.clients.forEach((w: any) => { if (w.dead) return w.terminate(); w.dead = true; w.ping(); }), 15_000);

  wss.on("connection", (ws: any) => {
    let sess: Sess | undefined, role: "display" | "ctrl" | undefined, attempts = 0;
    ws.on("pong", () => (ws.dead = false));
    ws.on("message", (raw: Buffer) => {
      let m: ClientMsg;
      try { m = ClientMsg.parse(JSON.parse(raw.toString())); } catch { return send(ws, { type: "error", code: "BAD_MESSAGE" }); }
      if (m.type === "register") {
        if (sess) return send(ws, { type: "error", code: "ALREADY_REGISTERED" });
        let code: string; do { code = generateCode(); } while (sessions.has(code)); // collision-safe, sync = atomic
        const s: Sess = { code, id: randomUUID(), display: ws, timer: setTimeout(() => drop(s, "expired"), o.maxSessionMs ?? ttl) };
        sessions.set(code, s); sess = s; role = "display";
        send(ws, { type: "registered", code, sessionId: s.id });
      } else if (m.type === "join") {
        if (sess) return send(ws, { type: "error", code: "ALREADY_REGISTERED" });
        if (++attempts > maxAttempts) { send(ws, { type: "error", code: "RATE_LIMITED" }); return ws.close(); }
        const s = sessions.get(m.code);
        if (!s) return send(ws, { type: "error", code: "NOT_FOUND" });
        if (s.ctrl) return send(ws, { type: "error", code: "BUSY" });
        s.ctrl = ws; sess = s; role = "ctrl";
        send(ws, { type: "joined", sessionId: s.id });
        send(s.display, { type: "peer-joined" });
      } else if (m.type === "signal") {
        if (!sess) return send(ws, { type: "error", code: "NOT_PAIRED" });
        send(role === "display" ? sess.ctrl : sess.display, { type: "signal", data: m.data });
      }
    });
    ws.on("close", () => {
      if (!sess) return;
      if (role === "display") drop(sess, "display-left");
      else { sess.ctrl = undefined; send(sess.display, { type: "peer-left" }); }
    });
  });
  return {
    sessions,
    port: () => (wss.address() as any).port as number,
    close: () => new Promise<void>((r) => { clearInterval(hb); sessions.forEach((s) => clearTimeout(s.timer)); wss.clients.forEach((c) => c.terminate()); wss.close(() => r()); }),
  };
}
