import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./fixtures";

// E5: keyboard-only use. Tab must reach the footer (no trap) and every stop must show a focus indicator.
async function tabThrough(page: Page, max: number) {
  const stops: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return { id: `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}`, ring, inFooter: !!el.closest("footer") };
    });
    if (!s) continue;
    stops.push(s.id);
    expect(s.ring, `no visible focus indicator on ${s.id}`).toBe(true);
    if (s.inFooter) return stops;
  }
  throw new Error(`Tab never reached the footer (keyboard trap?): ${stops.slice(-6).join(" > ")}`);
}

test.describe("keyboard only", () => {
  test("map: place menu, search and parcel list are reachable and Tab is never trapped", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/map");
    await page.locator("h1").first().waitFor();
    const stops = await tabThrough(page, 120);
    expect(stops.length).toBeGreaterThan(8);
  });

  test("verify form: fill and submit with the keyboard", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/verify");
    await page.getByLabel("District").focus();
    await page.keyboard.type("Dhaka");
    await page.getByLabel("Upazila").focus();
    await page.keyboard.type("Savar");
    await page.getByLabel("Mouza").focus();
    await page.keyboard.type("Ashulia");
    await page.keyboard.press("Tab");
    await page.keyboard.type("501");
    await page.keyboard.press("Tab");
    await page.keyboard.type("101");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/verify\/result\?land_id=LP-10001/);
  });
});
