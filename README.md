# WebRTC Teleprompter (core build)
Monorepo: `apps/web` (Next.js, Vercel), `apps/signaling` (Node `ws`, needs a persistent host such as Fly/Render/Railway — NOT a Vercel function), `packages/shared` (zod protocol).
No database: sessions live in signaling-server memory; scripts stay in browser localStorage; commands travel over WebRTC DataChannel.
## Run
```
npm install
cp .env.example apps/web/.env.local
npm run dev:signaling   # ws://localhost:8080
npm run dev:web         # http://localhost:3000
npm test && npm run typecheck && npm run build
```
Open `/display` on the laptop, enter the 8-digit code at `/controller` on the phone (same LAN: use the laptop's IP for both URLs and `NEXT_PUBLIC_SIGNALING_URL`).
## STUN vs TURN
STUN only discovers your public address; works on most home networks. TURN relays traffic and is needed behind symmetric NAT/strict firewalls. Add TURN via `NEXT_PUBLIC_*` ICE config only with short-lived credentials issued by a server endpoint (not yet implemented).
## Security notes
8-digit codes are guessable: join attempts are limited per socket (5), codes expire (default 10 min). Add per-IP limiting and origin checks behind your host's proxy for production.
## Not yet done
See the chat summary: Tailwind, Playwright, display approval, multi-controller, reconnect without re-pairing, full deployment guide.
