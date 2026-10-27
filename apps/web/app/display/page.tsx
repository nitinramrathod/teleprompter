"use client";
import { useEffect, useRef, useState } from "react";
import { parseCommand, speedToPxPerSec, type DisplayState } from "@tp/shared";
// import { SIGNALING, iceServers } from "../../lib/rtc";

import { signalingUrl, iceServers } from "../../lib/rtc";

const DEF: DisplayState = { t: "STATE_UPDATE", playing: false, speed: 2, fontSize: 56, lineHeight: 1.5, width: 70, mirrorH: false, mirrorV: false, theme: "dark", progress: 0 };

export default function Display() {
  const [code, setCode] = useState(""); const [status, setStatus] = useState("Connecting to server");
  const [text, setText] = useState(""); const [st, setSt] = useState(DEF);
  const stRef = useRef(st); stRef.current = st;
  const box = useRef<HTMLDivElement>(null); const dc = useRef<RTCDataChannel | null>(null);
  const dir = useRef(0); const [reading, setReading] = useState(false);

  useEffect(() => { setText(localStorage.getItem("tp-script") ?? ""); }, []);
  useEffect(() => { localStorage.setItem("tp-script", text); }, [text]);

  const snapshot = () => { const e = box.current; const max = e ? e.scrollHeight - e.clientHeight : 0; return { ...stRef.current, progress: max > 0 && e ? e.scrollTop / max : 0 }; };
  const push = () => { if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(snapshot())); };

  // rAF scroll loop: time-based (px/sec), manual and auto combined in one place
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now; const e = box.current;
      if (e) { const v = (dir.current !== 0 ? dir.current * 300 : stRef.current.playing ? speedToPxPerSec(stRef.current.speed) : 0); if (v) e.scrollTop += v * dt; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = new WebSocket(signalingUrl()); 
    
    let pc: RTCPeerConnection | null = null; let closed = false;
    const apply = (c: NonNullable<ReturnType<typeof parseCommand>>) => {
      const e = box.current;
      switch (c.t) {
        case "PLAY": return setSt((s) => ({ ...s, playing: true }));
        case "PAUSE": return setSt((s) => ({ ...s, playing: false }));
        case "SET_SPEED": return setSt((s) => ({ ...s, speed: c.v }));
        case "SET_FONT_SIZE": return setSt((s) => ({ ...s, fontSize: c.v }));
        case "SET_LINE_HEIGHT": return setSt((s) => ({ ...s, lineHeight: c.v }));
        case "SET_TEXT_WIDTH": return setSt((s) => ({ ...s, width: c.v }));
        case "SET_MIRROR": return setSt((s) => ({ ...s, mirrorH: c.h, mirrorV: c.v }));
        case "SET_THEME": return setSt((s) => ({ ...s, theme: c.v }));
        case "SCROLL": dir.current = c.dir === "up" ? -1 : c.dir === "down" ? 1 : 0; return;
        case "GO_TO_TOP": if (e) e.scrollTop = 0; return;
        case "GO_TO_BOTTOM": if (e) e.scrollTop = e.scrollHeight; return;
        case "REQUEST_STATE": return push();
      }
    };
    const setup = () => {
      pc?.close(); pc = new RTCPeerConnection({ iceServers: iceServers() });
      const ch = pc.createDataChannel("cmd", { ordered: true }); dc.current = ch;
      ch.onopen = () => { setStatus("Connected"); push(); };
      ch.onmessage = (ev) => { const c = parseCommand(ev.data); if (c) { apply(c); setTimeout(push, 0); } };
      ch.onclose = () => setStatus("Controller disconnected — waiting");
      pc.onicecandidate = (ev) => ev.candidate && ws?.send(JSON.stringify({ type: "signal", data: { candidate: ev.candidate } }));
      pc.onconnectionstatechange = () => { if (pc?.connectionState === "failed") setStatus("Connection failed (a TURN server may be needed)"); };
      pc.createOffer().then(async (o) => { await pc!.setLocalDescription(o); ws?.send(JSON.stringify({ type: "signal", data: { sdp: pc!.localDescription } })); });
    };
    ws.onmessage = async (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "registered") { setCode(m.code); setStatus("Waiting for controller"); }
      else if (m.type === "peer-joined") { setStatus("Connecting"); setup(); }
      else if (m.type === "peer-left") setStatus("Controller disconnected — waiting");
      else if (m.type === "signal" && pc) { if (m.data.sdp) await pc.setRemoteDescription(m.data.sdp); if (m.data.candidate) await pc.addIceCandidate(m.data.candidate); }
      else if (m.type === "closed") setStatus(m.reason === "expired" ? "Session expired — regenerate code" : "Session closed");
    };
    ws.onopen = () => ws!.send('{"type":"register"}');
    ws.onerror = () => setStatus("Cannot reach signaling server");
    return () => { closed = true; dc.current?.close(); pc?.close(); ws?.close(); ws = null; };
  }, [reading && false]);

  // keyboard shortcuts (ignored while typing)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return; const b = box.current;
      if (e.code === "Space") { e.preventDefault(); setSt((s) => ({ ...s, playing: !s.playing })); }
      else if (e.key === "ArrowUp") b?.scrollBy(0, -80); else if (e.key === "ArrowDown") b?.scrollBy(0, 80);
      else if (e.key === "Home" && b) b.scrollTop = 0; else if (e.key === "End" && b) b.scrollTop = b.scrollHeight;
      else if (e.key === "+") setSt((s) => ({ ...s, fontSize: Math.min(200, s.fontSize + 4) })); else if (e.key === "-") setSt((s) => ({ ...s, fontSize: Math.max(16, s.fontSize - 4) }));
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const dark = st.theme === "dark";
  const fs = () => { reading ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); setReading(!reading); };
  return <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    {!reading && <header style={{ padding: 16, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div><div style={{ opacity: .7 }}>Pairing code</div><div aria-live="polite" style={{ fontSize: 40, letterSpacing: 6, fontWeight: 700 }}>{code || "········"}</div></div>
      <div role="status">● {status}</div>
      <button onClick={() => location.reload()}>New code</button>
      <button onClick={() => confirm("Clear script?") && setText("")}>Clear script</button>
      <input type="file" accept=".txt" aria-label="Import .txt" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      <button onClick={fs}>Fullscreen reading</button>
    </header>}
    {!reading && <textarea aria-label="Script" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your script here…" style={{ height: 120, margin: "0 16px", background: "#15151c", color: "#fff" }} />}
    <div ref={box} style={{ flex: 1, overflow: "hidden", background: dark ? "#000" : "#fff", color: dark ? "#fff" : "#000", position: "relative" }}>
      <div style={{ width: `${st.width}%`, margin: "0 auto", padding: "40vh 0", fontSize: st.fontSize, lineHeight: st.lineHeight, whiteSpace: "pre-wrap", textAlign: "center", transform: `scale(${st.mirrorH ? -1 : 1}, ${st.mirrorV ? -1 : 1})` }}>{text || "Your script appears here."}</div>
      {reading && <div style={{ position: "fixed", top: 8, right: 12, fontSize: 12, opacity: .6 }}>● {status}</div>}
    </div>
  </div>;
}
