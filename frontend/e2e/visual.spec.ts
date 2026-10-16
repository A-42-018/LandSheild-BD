import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, signIn, type DemoRole } from "./fixtures";

/** R11 visual / overflow matrix. Screenshots are attached to the report (no committed baselines: pixels differ per OS);
 *  the hard gate is "no sideways scroll" for every route × width × language × theme. Set VISUAL_FULL=1 for the whole matrix. */
const FULL = !!process.env.VISUAL_FULL;
const WIDTHS = FULL ? [360, 768, 1024, 1440] : [360, 1024];
const LANGS = FULL ? ["en", "bn"] : ["en"];
const THEMES = FULL ? ["light", "dark"] : ["light"];

const PUBLIC = ["", "/login", "/officer-login", "/signup", "/officer-signup", "/track", "/verify-document", "/services", "/tools", "/tools/fees", "/tools/units", "/tools/inheritance", "/faq", "/about", "/privacy", "/sitemap", "/feedback", "/v/LP-10240", "/does-not-exist"];
const CITIZEN = ["/verify", "/check", "/verify/result?land_id=LP-10240", "/verify/graph?land_id=LP-10240", "/map"];
const STAFF: [DemoRole, string[]][] = [
  ["reviewer", ["/officer", "/officer/mutations", "/officer/archive"]],
  ["admin", ["/officer", "/officer/admin", "/officer/audit-logs", "/officer/upload", "/officer/feedback"]],
];

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem("ls-theme", t), theme);
    });
    for (const w of WIDTHS) {
      for (const lang of LANGS) {
        const run = (role: DemoRole | null, paths: string[]) =>
          test(`${role ?? "public"} @${w} ${lang}: ${paths.length} routes fit`, async ({ page }, info) => {
            await page.setViewportSize({ width: w, height: 800 });
            if (role) await signIn(page, role);
            for (const p of paths) {
              await page.goto(`/${lang}${p}`, { waitUntil: "networkidle" });
              await expect(page.locator("main, #main").first()).toBeVisible();
              await expectNoHorizontalScroll(page);
              await info.attach(`${theme}-${lang}-${w}${p.replace(/\W+/g, "_") || "_home"}.png`, { body: await page.screenshot(), contentType: "image/png" });
            }
          });
        run(null, PUBLIC);
        run("citizen", CITIZEN);
        for (const [role, paths] of STAFF) if (w === 1024 || FULL) run(role, paths);
      }
    }
  });
}
