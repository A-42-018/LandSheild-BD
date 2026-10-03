import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import bn from "../messages/bn.json";

const FORBIDDEN_EN = ["fraud confirmed", "proven", "forged", "illegal", "guilty"];
const FORBIDDEN_BN = ["জালিয়াতি নিশ্চিত", "প্রমাণিত", "জাল দলিল", "জাল", "অবৈধ", "দোষী"];

const strings = (o: unknown): string[] =>
  typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(strings) : [];

describe("risk wording (R3)", () => {
  it("EN messages contain no forbidden phrases", () => {
    const text = strings(en).join("\n").toLowerCase();
    for (const w of FORBIDDEN_EN) expect(text, w).not.toContain(w);
  });
  it("BN messages contain no forbidden phrases", () => {
    const text = strings(bn).join("\n");
    for (const w of FORBIDDEN_BN) expect(text, w).not.toContain(w);
  });
  it("EN evidence uses only approved framing", () => {
    const approved = ["potential inconsistency", "possible duplicate transaction", "review required", "high-risk indicator", "ownership conflict detected", "informational", "human review required"];
    for (const [code, msg] of Object.entries(en.risk.evidence as Record<string, string>)) {
      expect(approved.some((a) => msg.toLowerCase().includes(a)), code).toBe(true);
    }
  });
});
