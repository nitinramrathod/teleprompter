"use client";
import { useEffect, useRef, useState } from "react";
import { DisplayState, isValidCode, type Command } from "@tp/shared";
// import { SIGNALING, iceServers } from "../../lib/rtc";
import { signalingUrl, iceServers } from "../../lib/rtc";

const ERR: Record<string, string> = { NOT_FOUND: "Code not found or expired.", BUSY: "Display already has a controller.", RATE_LIMITED: "Too many attempts. Reload and retry.", BAD_MESSAGE: "Invalid request." };
const btn = { padding: "18px 12px", fontSize: 18, borderRadius: 12, border: 0, background: "#2563eb", color: "#fff", touchAction: "manipulation" } as const;

export default function Controller() {
  const [code, setCode] = useState(""); const [err, setErr] = useState(""); const [status, setStatus] = useState("Idle");
   const [draft, setDraft] = useState("");
  const [st, setSt] = useState<DisplayState | null>(null); const dc = useRef<RTCDataChannel | null>(null); const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  const send = (c: Command) => dc.current?.readyState === "open" && dc.current.send(JSON.stringify(c));
    const sendScript = () => {
    const id = Math.random().toString(36).slice(2); // crypto.randomUUID needs HTTPS, so avoid it on LAN http
    const parts = draft.match(/[\s\S]{1,3000}/g) ?? [""];
    if (parts.length > 100) return setErr("Script too long (max about 300,000 characters).");
    parts.forEach((d, i) => send({ t: "SCRIPT_CHUNK", id, i, n: parts.length, d }));
  };

  const connect = () => {
    setErr(""); if (!isValidCode(code)) return setErr("Enter exactly 8 digits.");
    setStatus("Connecting"); const ws = new WebSocket(signalingUrl()); 
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const to = setTimeout(() => { setErr("Connection timed out."); setStatus("Idle"); cleanup.current(); }, 20000);
    cleanup.current = () => { clearTimeout(to); dc.current?.close(); pc.close(); ws.close(); dc.current = null; };
    ws.onopen = () => ws.send(JSON.stringify({ type: "join", code }));
    ws.onerror = () => { setErr(`Cannot reach ${signalingUrl()}`); setStatus("Idle"); };
    pc.onicecandidate = (e) => e.candidate && ws.send(JSON.stringify({ type: "signal", data: { candidate: e.candidate } }));
    pc.ondatachannel = (e) => {
      const ch = e.channel; dc.current = ch;
      ch.onopen = () => { clearTimeout(to); setStatus("Connected"); send({ t: "REQUEST_STATE" }); };
      ch.onclose = () => { setStatus("Disconnected"); setSt(null); };
      ch.onmessage = (ev) => { try { const r = DisplayState.safeParse(JSON.parse(ev.data)); if (r.success) setSt(r.data); } catch {} };
    };
    pc.onconnectionstatechange = () => pc.connectionState === "failed" && setErr("ICE failed — network may need a TURN server.");
    ws.onmessage = async (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "error") { setErr(ERR[m.code] ?? "Error"); setStatus("Idle"); cleanup.current(); }
      else if (m.type === "signal") {
        if (m.data.sdp) { await pc.setRemoteDescription(m.data.sdp); const a = await pc.createAnswer(); await pc.setLocalDescription(a); ws.send(JSON.stringify({ type: "signal", data: { sdp: pc.localDescription } })); }
        if (m.data.candidate) await pc.addIceCandidate(m.data.candidate);
      } else if (m.type === "closed") { setStatus("Display ended session"); setSt(null); }
    };
  };
  const hold = (dir: "up" | "down") => ({ onPointerDown: () => send({ t: "SCROLL", dir }), onPointerUp: () => send({ t: "SCROLL", dir: "stop" }), onPointerLeave: () => send({ t: "SCROLL", dir: "stop" }), onPointerCancel: () => send({ t: "SCROLL", dir: "stop" }) });

  if (!st) return <main style={{ maxWidth: 420, margin: "10vh auto", padding: 16, display: "grid", gap: 12 }}>
    <h1>Controller</h1>
    <label>Display code<input inputMode="numeric" autoComplete="off" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ display: "block", width: "100%", fontSize: 32, letterSpacing: 6, padding: 12 }} /></label>
    {err && <div role="alert" style={{ color: "#f87171" }}>{err}</div>}
    <button style={btn} onClick={connect}>Connect</button><div role="status">{status}</div>
  </main>;

  return <main style={{ padding: 16, display: "grid", gap: 14, maxWidth: 520, margin: "0 auto", userSelect: "none" }}>
    <div role="status">● {status} <button onClick={() => cleanup.current()} style={{ float: "right" }}>Disconnect</button></div>
    <button style={{ ...btn, fontSize: 28, padding: 28, background: st.playing ? "#dc2626" : "#16a34a" }} onClick={() => send({ t: st.playing ? "PAUSE" : "PLAY" })}>{st.playing ? "Pause" : "Play"}</button>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><button style={btn} {...hold("up")}>▲ Scroll up</button><button style={btn} {...hold("down")}>▼ Scroll down</button></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><button style={btn} onClick={() => send({ t: "GO_TO_TOP" })}>Top</button><button style={btn} onClick={() => send({ t: "GO_TO_BOTTOM" })}>Bottom</button></div>
    <label>Speed: {st.speed}<input type="range" min={1} max={10} step={0.5} value={st.speed} onChange={(e) => send({ t: "SET_SPEED", v: +e.target.value })} style={{ width: "100%" }} /></label>
    <label>Text size: {st.fontSize}<input type="range" min={16} max={200} value={st.fontSize} onChange={(e) => send({ t: "SET_FONT_SIZE", v: +e.target.value })} style={{ width: "100%" }} /></label>
    <label>Line spacing: {st.lineHeight}<input type="range" min={1} max={3} step={0.1} value={st.lineHeight} onChange={(e) => send({ t: "SET_LINE_HEIGHT", v: +e.target.value })} style={{ width: "100%" }} /></label>
    <label>Width: {st.width}%<input type="range" min={30} max={100} value={st.width} onChange={(e) => send({ t: "SET_TEXT_WIDTH", v: +e.target.value })} style={{ width: "100%" }} /></label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <button style={btn} onClick={() => send({ t: "SET_MIRROR", h: !st.mirrorH, v: st.mirrorV })}>Mirror H</button>
      <button style={btn} onClick={() => send({ t: "SET_MIRROR", h: st.mirrorH, v: !st.mirrorV })}>Flip V</button>
      <button style={btn} onClick={() => send({ t: "SET_THEME", v: st.theme === "dark" ? "light" : "dark" })}>Theme</button></div>
      <label>New script
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste script here…" rows={6} style={{ width: "100%", fontSize: 16, padding: 8, userSelect: "text" }} />
      </label>
      <button style={btn} onClick={sendScript}>Send to display</button>
      {err && <div role="alert" style={{ color: "#f87171" }}>{err}</div>}
  </main>;
}
