import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import bn from "../messages/bn.json";

/**
 * U4.5: empty, loading and error states are plain Bangla and say what to do next.
 * A "state key" is any key whose last segment names a state (empty, loading, error, failed, not found ...).
 * Wording rules come from docs/ui.md (glossary) and roadmap §5.
 */
function entries(obj: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? entries(v as Record<string, unknown>, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)] as [string, string]],
  );
}

const STATE_KEY = /(^|\.)(empty\w*|loading\w*|searching|slow|notFound|noMatch|noParcels|\w*Error|\w*Failed|failed|processing)$|^errors\./;
const stateKeys = (m: Record<string, unknown>) => entries(m).filter(([k]) => STATE_KEY.test(k) && !k.startsWith("risk.evidence") && !k.startsWith("officer.activity.actions"));

/** Words a citizen would not say at a land office (docs/ui.md). */
// "লোড" alone would also hit "আপলোড" (upload), which staff screens may keep.
const BANNED_BN = [/অনুগ্রহ করে/, /(?<!আপ)লোড/, /প্রক্রিয়াকরণ/, /প্রক্রিয়া করতে/, /ব্যর্থ/, /সম্পন্ন করা যায়নি/, /নথিভুক্ত নেই/];
/** Pages that promise features later. */
const PLACEHOLDER = [/placeholder/i, /under construction/i, /coming soon/i, /later phase/i, /নির্মাণাধীন/, /নির্মাণ কাজ/, /শীঘ্রই আসছে/, /পরবর্তী ধাপে আসবে/, /অস্থায়ী পৃষ্ঠা/];

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/[।?!.](?:\s|$)/).map((x) => x.trim()).filter(Boolean);

describe("state copy (U4.5)", () => {
  const bnStates = stateKeys(bn);
  const enStates = stateKeys(en);

  it("finds the state strings in both locales", () => {
    expect(bnStates.length).toBeGreaterThan(80);
    expect(bnStates.map(([k]) => k).sort()).toEqual(enStates.map(([k]) => k).sort());
  });

  it("Bangla state strings avoid stiff or English-sounding words", () => {
    const bad = bnStates.flatMap(([k, v]) => BANNED_BN.filter((re) => re.test(v)).map((re) => `${k}: ${re} in ${v}`));
    expect(bad).toEqual([]);
  });

  it("every sentence in a state string is under 20 words, in both languages", () => {
    const long = [...bnStates, ...enStates].flatMap(([k, v]) => sentences(v).filter((s) => words(s) >= 20).map((s) => `${k}: ${s}`));
    expect(long).toEqual([]);
  });

  it("a failure says what to do next: try again, check, sign in or wait", () => {
    const FAILURE = /(loadError|Error|Failed|failed)$/;
    const NEXT_BN = /(আবার|দেখুন|দেখে|করুন|বেছে|লিখুন)/;
    const NEXT_EN = /(again|check|sign in|wait|choose|enter)/i;
    const bad = (m: Record<string, unknown>, next: RegExp) =>
      stateKeys(m).filter(([k, v]) => FAILURE.test(k) && !next.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(bad(bn, NEXT_BN)).toEqual([]);
    expect(bad(en, NEXT_EN)).toEqual([]);
  });

  it("an empty list says what is missing, not just a bare 'no records'", () => {
    for (const m of [en, bn] as Record<string, unknown>[]) {
      const bare = entries(m).filter(([, v]) => /^(No records found\.?|কোনো রেকর্ড পাওয়া যায়নি।?)$/.test(v));
      expect(bare).toEqual([]);
    }
  });

  it("no message promises a page that is not built yet", () => {
    const hits = [...entries(en), ...entries(bn)].flatMap(([k, v]) => PLACEHOLDER.filter((re) => re.test(v)).map((re) => `${k}: ${re} in ${v}`));
    expect(hits).toEqual([]);
  });

  it("the shared defaults exist in both languages: loading, slow, empty, and one sentence per kind of failure", () => {
    for (const m of [en, bn]) {
      for (const k of ["offline", "server", "tooMany", "signedOut", "permission", "generic"] as const) {
        expect((m.errors as Record<string, string>)[k], k).toBeTruthy();
      }
      expect(m.common.loading).toBeTruthy();
      expect(m.common.slow).toBeTruthy();
      expect(m.common.empty).toBeTruthy();
    }
  });
});
