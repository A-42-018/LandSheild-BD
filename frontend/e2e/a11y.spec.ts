import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, signIn, type DemoRole } from "./fixtures";

// E5: real-browser axe (colour contrast + landmarks included) on every route, EN + BN, at the
// narrowest supported width (360 px) with the largest text-size setting (125 %).
const axePath = join(process.cwd(), "node_modules/axe-core/axe.min.js");

const PUBLIC = [
  "", "about", "faq", "accessibility", "privacy", "terms", "data-sources", "sitemap", "services", "feedback",
  "track", "verify-document", "tools", "tools/units", "tools/fees", "tools/inheritance", "login", "officer-signup",
  "no-such-page", "v/LP-10001",
];
const SIGNED_IN: [DemoRole, string[]][] = [
  ["citizen", ["verify", "check", "map", "verify/result?land_id=LP-10240", "verify/graph?land_id=LP-10240"]],
  ["officer", ["officer", "officer/upload", "officer/mutations", "officer/archive", "officer/audit-logs", "officer/feedback"]],
  ["admin", ["officer/admin"]],
];

test.use({ viewport: { width: 360, height: 800 } });

async function audit(page: Page, path: string, loc: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("ls-text-size", "125");
    window.localStorage.setItem("ls-theme", "light");
  });
  await page.goto(`/${loc}${path ? `/${path}` : ""}`);
  await page.locator("main").first().waitFor();
  await page.waitForTimeout(1200); // data panels and the map settle
  await page.addScriptTag({ path: axePath });
  const found = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v: any) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n: any) => n.target.join(" ")).join(" | ")}`);
  });
  expect(found, `${loc}/${path}`).toEqual([]);
  await expectNoHorizontalScroll(page);
}

for (const loc of ["en", "bn"]) {
  test.describe(`axe @360px 125% (${loc})`, () => {
    for (const p of PUBLIC) test(`public /${p}`, async ({ page }) => audit(page, p, loc));
    for (const [role, paths] of SIGNED_IN) {
      for (const p of paths) {
        test(`${role} /${p}`, async ({ page }) => {
          await signIn(page, role);
          await audit(page, p, loc);
        });
      }
    }
  });
}
