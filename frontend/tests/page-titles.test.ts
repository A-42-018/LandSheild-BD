import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import bn from "../messages/bn.json";

// U5.4 (WCAG 2.4.2): every page has its own <title>, so a screen reader says where a link went
// (Next only announces a route change when the title changes) and tabs and history are told apart.
const APP = resolve(process.cwd(), "app/[locale]");
// the home page keeps the bare site name; /officer/admin only redirects to /admin
const UNTITLED = ["page.tsx", "officer/admin/page.tsx"];

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return pages(p);
    return n === "page.tsx" ? [relative(APP, p)] : [];
  });
}
const get = (m: unknown, key: string) => key.split(".").reduce<any>((o, k) => o?.[k], m);
const titleKey = (file: string) => readFileSync(join(APP, file), "utf8").match(/generateMetadata = pageTitle\("([^"]+)"\)/)?.[1];

describe("page titles (U5.4)", () => {
  const all = pages(APP);

  it("every page sets its own title", () => {
    const missing = all.filter((f) => !UNTITLED.includes(f) && !titleKey(f));
    expect(missing).toEqual([]);
  });

  it("each title key is a plain string in both languages", () => {
    for (const f of all.filter((x) => titleKey(x))) {
      const key = titleKey(f)!;
      for (const [loc, msgs] of [["en", en], ["bn", bn]] as const) {
        const v = get(msgs, key);
        expect(typeof v, `${f}: ${loc} ${key}`).toBe("string");
        expect(v, `${f}: ${loc} ${key} has a placeholder`).not.toMatch(/[{}]/);
      }
    }
  });

  it("the layout adds the site name to each page title", () => {
    const layout = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(layout).toMatch(/template: `%s \| \$\{t\("appName"\)\}`/);
  });
});
