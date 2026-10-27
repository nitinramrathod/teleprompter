import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { startSignaling } from "./server";

let srv: ReturnType<typeof startSignaling>;
afterEach(() => srv.close());
const open = (p: number) => new Promise<{ ws: WebSocket; next: () => Promise<any> }>((res) => {
  const ws = new WebSocket(`ws://localhost:${p}`); const q: any[] = []; let w: ((v: any) => void) | null = null;
  ws.on("message", (d) => { const m = JSON.parse(d.toString()); w ? (w(m), (w = null)) : q.push(m); });
  ws.on("open", () => res({ ws, next: () => (q.length ? Promise.resolve(q.shift()) : new Promise((r) => (w = r))) }));
});

describe("signaling", () => {
  it("pairs and routes signals only to the counterpart", async () => {
    srv = startSignaling({ port: 0 });
    const d = await open(srv.port()); d.ws.send('{"type":"register"}');
    const reg = await d.next(); expect(reg.code).toMatch(/^\d{8}$/);
    const c = await open(srv.port()); c.ws.send(JSON.stringify({ type: "join", code: reg.code }));
    expect((await c.next()).type).toBe("joined"); expect((await d.next()).type).toBe("peer-joined");
    c.ws.send('{"type":"signal","data":{"sdp":{"x":1}}}');
    expect((await d.next()).data.sdp).toEqual({ x: 1 });
  });
  it("rejects unknown code, bad messages, second controller", async () => {
    srv = startSignaling({ port: 0 });
    const d = await open(srv.port()); d.ws.send('{"type":"register"}'); const { code } = await d.next();
    const c1 = await open(srv.port()); c1.ws.send(JSON.stringify({ type: "join", code: "00000000" }));
    expect((await c1.next()).code).toBe("NOT_FOUND");
    c1.ws.send("garbage"); expect((await c1.next()).code).toBe("BAD_MESSAGE");
    c1.ws.send(JSON.stringify({ type: "join", code })); expect((await c1.next()).type).toBe("joined");
    const c2 = await open(srv.port()); c2.ws.send(JSON.stringify({ type: "join", code })); expect((await c2.next()).code).toBe("BUSY");
  });
  it("rate limits join attempts", async () => {
    srv = startSignaling({ port: 0, maxAttempts: 2 });
    const c = await open(srv.port());
    for (let i = 0; i < 2; i++) { c.ws.send('{"type":"join","code":"11111111"}'); await c.next(); }
    c.ws.send('{"type":"join","code":"11111111"}'); expect((await c.next()).code).toBe("RATE_LIMITED");
  });
  it("expires sessions and cleans up on display disconnect", async () => {
    srv = startSignaling({ port: 0, maxSessionMs: 50 });
    const d = await open(srv.port()); d.ws.send('{"type":"register"}'); await d.next();
    expect(srv.sessions.size).toBe(1);
    expect((await d.next()).reason).toBe("expired"); expect(srv.sessions.size).toBe(0);
    srv.close(); srv = startSignaling({ port: 0 });
    const d2 = await open(srv.port()); d2.ws.send('{"type":"register"}'); await d2.next(); d2.ws.close();
    await new Promise((r) => setTimeout(r, 100)); expect(srv.sessions.size).toBe(0);
  });
});
