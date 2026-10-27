import Link from "next/link";
const b = { display: "block", padding: "20px 28px", background: "#2563eb", color: "#fff", borderRadius: 12, textDecoration: "none", fontSize: 20, textAlign: "center" as const };
export default function Home() {
  return <main style={{ maxWidth: 520, margin: "10vh auto", padding: 16, display: "grid", gap: 16 }}>
    <h1>Teleprompter</h1>
    <p>Open <b>Display</b> on the screen that shows the script. It shows an 8-digit code. Enter that code on your phone via <b>Controller</b> to control it in real time over WebRTC.</p>
    <Link href="/display" style={b}>Connect as Display</Link>
    <Link href="/controller" style={{ ...b, background: "#16a34a" }}>Connect as Controller</Link>
  </main>;
}
