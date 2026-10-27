import { startSignaling } from "./server";
const s = startSignaling({ port: Number(process.env.PORT ?? 8080), codeTtlMs: Number(process.env.CODE_TTL_MS ?? 600000), maxAttempts: Number(process.env.MAX_JOIN_ATTEMPTS ?? 5) });
console.log("signaling listening on", s.port());
