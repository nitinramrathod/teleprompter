import { z } from "zod";
import { randomInt } from "node:crypto";

export const PROTOCOL_VERSION = 1;
export const CODE_RE = /^\d{8}$/;
export const isValidCode = (c: unknown): c is string => typeof c === "string" && CODE_RE.test(c);
/** Cryptographically secure 8-digit code (Node only; server uses it). */
export const generateCode = (): string => String(randomInt(0, 100_000_000)).padStart(8, "0");

// Signaling (client -> server)
export const ClientMsg = z.discriminatedUnion("type", [
  z.object({ type: z.literal("register") }),
  z.object({ type: z.literal("join"), code: z.string().regex(CODE_RE) }),
  z.object({ type: z.literal("signal"), data: z.object({ sdp: z.any().optional(), candidate: z.any().optional() }) }),
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

// DataChannel commands (controller -> display)
const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const Command = z.discriminatedUnion("t", [
  z.object({ t: z.literal("PLAY") }),
  z.object({ t: z.literal("PAUSE") }),
  z.object({ t: z.literal("SET_SPEED"), v: n(1, 10) }),
  z.object({ t: z.literal("SET_FONT_SIZE"), v: n(16, 200) }),
  z.object({ t: z.literal("SET_LINE_HEIGHT"), v: n(1, 3) }),
  z.object({ t: z.literal("SET_TEXT_WIDTH"), v: n(30, 100) }),
  z.object({ t: z.literal("SCROLL"), dir: z.enum(["up", "down", "stop"]) }), // held control: start/stop, no per-frame traffic
  z.object({ t: z.literal("GO_TO_TOP") }),
  z.object({ t: z.literal("GO_TO_BOTTOM") }),
  z.object({ t: z.literal("SET_MIRROR"), h: z.boolean(), v: z.boolean() }),
  z.object({ t: z.literal("SET_THEME"), v: z.enum(["dark", "light"]) }),
  z.object({ t: z.literal("REQUEST_STATE") }),
]);
export type Command = z.infer<typeof Command>;

export const DisplayState = z.object({
  t: z.literal("STATE_UPDATE"), playing: z.boolean(), speed: z.number(), fontSize: z.number(),
  lineHeight: z.number(), width: z.number(), mirrorH: z.boolean(), mirrorV: z.boolean(),
  theme: z.enum(["dark", "light"]), progress: z.number(),
});
export type DisplayState = z.infer<typeof DisplayState>;

export const MAX_DC_BYTES = 4096;
export function parseCommand(raw: unknown): Command | null {
  if (typeof raw !== "string" || raw.length > MAX_DC_BYTES) return null;
  try { const r = Command.safeParse(JSON.parse(raw)); return r.success ? r.data : null; } catch { return null; }
}
/** Documented speed mapping: level -> pixels per second. */
export const speedToPxPerSec = (level: number) => level * 40;
