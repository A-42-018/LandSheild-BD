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

  // U5.4 (WCAG 2.4.11): a control reached with Tab / Shift+Tab is never hidden under the sticky header or the
  // result page's bottom action bar (169 px tall in Bangla at 360 px).
  for (const [name, role, path, back] of [
    ["faq, Shift+Tab from the footer", null, "/bn/faq", true],
    ["result at 360 px, Tab down the page", "citizen", "/bn/verify/result?land_id=LP-10240", false],
  ] as const) {
    test(`focus is never under the sticky header or bottom bar: ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      if (role) await signIn(page, role);
      await page.goto(path);
      await page.locator("h1").first().waitFor();
      await page.waitForTimeout(1200);
      if (back) {
        await page.locator("footer a").first().focus();
      } else {
        await page.keyboard.press("Tab"); // skip link
        await page.keyboard.press("Enter"); // Tab now continues from the top of <main>
      }
      const hidden: string[] = [];
      let stops = 0;
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press(back ? "Shift+Tab" : "Tab");
        const r = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el?.closest("main")) return { inMain: false, under: null };
          if (el.closest("[data-sticky-bar]")) return { inMain: true, under: null };
          const box = el.getBoundingClientRect();
          if (box.height > 120) return { inMain: true, under: null }; // a tall tab panel may sit partly under a bar; it is still visible
          const header = [...document.querySelectorAll("header")].find((h) => getComputedStyle(h).position === "sticky")!;
          const bar = document.querySelector<HTMLElement>("[data-sticky-bar]");
          const under =
            box.top < header.getBoundingClientRect().bottom - 1 ||
            (!!bar && getComputedStyle(bar).position === "sticky" && box.bottom > bar.getBoundingClientRect().top + 1);
          return { inMain: true, under: under ? `${el.tagName}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}` : null };
        });
        if (r.inMain) stops++;
        else if (stops > 0) break; // walked all of <main>
        if (r.under) hidden.push(r.under);
      }
      expect(stops).toBeGreaterThan(5);
      expect(hidden).toEqual([]);
    });
  }

  // Chrome only scrolls on Tab when the next control is outside the scrollport minus scroll-padding. A control
  // already on screen but behind the bottom bar (the page was scrolled by touch) stays there without the padding.
  test("result at 360 px: Tab to a control sitting behind the bottom bar scrolls it clear", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await signIn(page, "citizen");
    await page.goto("/bn/verify/result?land_id=LP-10240");
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(1200);
    const behind = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>("[data-sticky-bar]")!;
      const all = [...document.querySelectorAll<HTMLElement>("main a[href], main button, main input, main select, main summary")]
        .filter((e) => e.offsetParent && !bar.contains(e) && e.getBoundingClientRect().height < 120);
      // the first control that starts below the bar at the top of the page, so the page can scroll it behind the bar
      const i = all.findIndex((e) => e.getBoundingClientRect().top + window.scrollY > bar.getBoundingClientRect().top + 40);
      const target = all[i];
      target.setAttribute("data-target", "");
      window.scrollBy(0, target.getBoundingClientRect().top - (bar.getBoundingClientRect().top + 8));
      all[i - 1].focus({ preventScroll: true });
      return target.getBoundingClientRect().top > bar.getBoundingClientRect().top;
    });
    expect(behind, "setup: the control starts behind the bar").toBe(true);
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement!;
      const bar = document.querySelector("[data-sticky-bar]")!;
      return { onTarget: el.hasAttribute("data-target"), bottom: el.getBoundingClientRect().bottom, barTop: bar.getBoundingClientRect().top };
    });
    expect(r.onTarget).toBe(true);
    expect(r.bottom).toBeLessThanOrEqual(r.barTop);
  });

  test("a link click is announced: each page has its own title (U5.4)", async ({ page }) => {
    await page.goto("/bn/about");
    await expect(page).toHaveTitle("LandShield BD সম্পর্কে | LandShield BD");
    await page.locator('main a[href="/bn/verify"], footer a[href="/bn/verify"]').first().click();
    await expect(page).toHaveURL(/\/bn\/verify$/);
    await expect(page).toHaveTitle("ভূমি যাচাই | LandShield BD");
    const said = await page.evaluate(() => document.querySelector("next-route-announcer")?.shadowRoot?.textContent ?? "");
    expect(said).toContain("ভূমি যাচাই");
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
