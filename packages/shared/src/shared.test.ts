import { describe, it, expect } from "vitest";
import { generateCode, isValidCode, parseCommand, speedToPxPerSec } from "./index";
describe("shared", () => {
  it("codes are 8 digits and unique-ish", () => {
    const s = new Set(Array.from({ length: 500 }, generateCode));
    expect(s.size).toBeGreaterThan(495);
    for (const c of s) expect(isValidCode(c)).toBe(true);
  });
  it("rejects bad codes", () => { for (const c of ["1234567", "123456789", "abcdefgh", "", 12345678]) expect(isValidCode(c)).toBe(false); });
  it("validates commands", () => {
    expect(parseCommand('{"t":"PLAY"}')).toEqual({ t: "PLAY" });
    expect(parseCommand('{"t":"SET_SPEED","v":999}')).toBeNull();
    expect(parseCommand("nope")).toBeNull();
    // expect(parseCommand("x".repeat(5000))).toBeNull();
    expect(parseCommand("x".repeat(20000))).toBeNull();
  });
  it("maps speed", () => expect(speedToPxPerSec(3)).toBe(120));
});
