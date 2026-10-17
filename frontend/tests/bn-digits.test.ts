import { describe, expect, it } from "vitest";
import bn from "../messages/bn.json";

/**
 * U0.2: no Latin digits in the Bangla UI. Allowlist is per key, and per key only
 * the listed tokens may carry Latin digits (docs/ui.md → "Latin script allowed only for").
 * Codes the user must type exactly, and licence names.
 */
const ALLOWED: Record<string, string[]> = {
  "upload.landIdHint": ["LP-10100"],
  "result.notFoundHint": ["LP-10100"],
  "upload.errors.LAND_ID": ["LP-10100"],
  "track.numberHint": ["MUT-2026-0001", "FB-2026-00001"],
  "track.errors.format": ["MUT-2026-0001"],
  "track.example": ["MUT-2026-0001"],
  "info.dataSources.s2.items.i1": ["CC BY 4.0"],
};

function entries(obj: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? entries(v as Record<string, unknown>, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)] as [string, string]],
  );
}

/**
 * Literal text of an ICU message: drops argument names, types, styles, plural/select
 * selectors (`=0`, `offset:1`) and `#`, keeps every branch's text.
 */
function icuLiteralText(msg: string): string {
  let i = 0;
  const fail = (why: string): never => {
    throw new Error(`${why} at ${i} in: ${msg}`);
  };
  const skipWs = () => {
    while (i < msg.length && /\s/.test(msg[i])) i++;
  };
  const token = () => {
    const start = i;
    while (i < msg.length && !/[\s,{}]/.test(msg[i])) i++;
    return msg.slice(start, i);
  };

  function message(inPlural: boolean, nested: boolean): string {
    let out = "";
    while (i < msg.length) {
      const c = msg[i];
      if (c === "}") {
        if (!nested) fail("unexpected }");
        i++;
        return out;
      }
      i++;
      if (c === "{") out += argument(inPlural);
      else if (!(c === "#" && inPlural)) out += c;
    }
    if (nested) fail("unclosed {");
    return out;
  }

  function argument(inPlural: boolean): string {
    skipWs();
    token();
    skipWs();
    if (msg[i] === "}") return (i++, "");
    if (msg[i] !== ",") fail("expected , or }");
    i++;
    skipWs();
    const type = token();
    skipWs();
    if (msg[i] === "}") return (i++, "");
    if (msg[i] !== ",") fail("expected , or }");
    i++;
    if (!["plural", "select", "selectordinal"].includes(type)) {
      // number/date/time style: no literal UI text.
      while (i < msg.length && msg[i] !== "}") i++;
      if (msg[i] !== "}") fail("unclosed {");
      i++;
      return "";
    }
    let out = "";
    for (;;) {
      skipWs();
      if (msg[i] === "}") return (i++, out);
      const sel = token();
      if (!sel) fail("expected selector");
      if (sel.startsWith("offset:")) continue;
      skipWs();
      if (msg[i] !== "{") fail("expected { after selector");
      i++;
      out += " " + message(type === "select" ? inPlural : true, true);
    }
  }

  return message(false, false);
}

const LATIN_DIGIT = /[0-9]/;

describe("icuLiteralText", () => {
  it("drops placeholders, selectors and #", () => {
    expect(icuLiteralText("{count, plural, =0 {আজ} one {# দিন} other {# দিন}}")).not.toMatch(LATIN_DIGIT);
    expect(icuLiteralText("তারিখ {date}")).toBe("তারিখ ");
    expect(icuLiteralText("{n, plural, offset:1 =1 {এক} other {অনেক}}")).not.toMatch(LATIN_DIGIT);
    expect(icuLiteralText("{v, number, ::percent}")).toBe("");
  });
  it("keeps Latin digits typed into branch text and plain text", () => {
    expect(icuLiteralText("{count, plural, =0 {আজ} other {# দিন, 3 বার}}")).toMatch(LATIN_DIGIT);
    expect(icuLiteralText("{x, select, a {ক 7} other {খ}}")).toMatch(LATIN_DIGIT);
    expect(icuLiteralText("১০ এমবি বা 10 MB")).toMatch(LATIN_DIGIT);
  });
  it("rejects malformed messages instead of passing them", () => {
    expect(() => icuLiteralText("{count, plural, =0 {আজ}")).toThrow();
    expect(() => icuLiteralText("আজ}")).toThrow();
  });
});

describe("bn.json digits (U0.2)", () => {
  const all = entries(bn as Record<string, unknown>);
  const byKey = new Map(all);

  it("no Latin digits outside ICU syntax and the per-key allowlist", () => {
    const bad = all.flatMap(([key, value]) => {
      let text = icuLiteralText(value);
      for (const tok of ALLOWED[key] ?? []) text = text.split(tok).join("");
      return LATIN_DIGIT.test(text) ? [`${key}: ${value}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it("allowlist has no stale entries", () => {
    for (const [key, toks] of Object.entries(ALLOWED)) {
      expect(byKey.has(key), key).toBe(true);
      for (const tok of toks) expect(byKey.get(key), key).toContain(tok);
    }
  });
});
