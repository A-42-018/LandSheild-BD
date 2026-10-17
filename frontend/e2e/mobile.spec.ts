import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, fillVerifyForm, openEvidenceTab, signIn } from "./fixtures";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test.describe("mobile viewport (375 px)", () => {
  // the last test runs as a narrow desktop window (isMobile off): mobile emulation hides this kind of overflow
  test("menu opens, verify flow completes, no sideways scroll", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en");
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");

    await page.goto("/en/verify");
    await expectNoHorizontalScroll(page);
    await fillVerifyForm(page);
    await openEvidenceTab(page);
    await expect(page.getByTestId("risk-section")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("Bangla result page fits 375 px", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/bn/verify/result?land_id=LP-10100");
    await openEvidenceTab(page);
    await expect(page.getByTestId("risk-section")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test.describe("narrow desktop window", () => {
  test.use({ isMobile: false, hasTouch: false });
  test("HIGH-risk result, mutation queue and admin console fit 375 px (tab bars scroll inside themselves)", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/en/verify/result?land_id=LP-10240");
    await expect(page.getByTestId("verdict")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await openEvidenceTab(page);
    await expect(page.getByTestId("risk-section")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto("/en/officer/mutations");
    await expect(page.getByRole("tab").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
  });
});

test.describe("UI v2 mobile patterns (375 px)", () => {
  test("track page: What you need collapses above the form; Bangla form fits", async ({ page }) => {
    await page.goto("/bn/track");
    const need = page.getByTestId("what-you-need").locator("details");
    await expect(need).not.toHaveAttribute("open", "");
    await need.locator("summary").click();
    await expect(need).toHaveAttribute("open", "");
    await expectNoHorizontalScroll(page);
  });
  test("tables stack into label/value cards", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/verify/result?land_id=LP-10100");
    await page.getByTestId("section-transactions").locator("summary").click();
    const cell = page.locator("td[data-label]").first();
    await expect(cell).toBeVisible();
    expect(await cell.evaluate((el) => getComputedStyle(el).display)).toBe("flex");
    await expectNoHorizontalScroll(page);
  });
});
