import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, fillVerifyForm, openEvidenceTab, signIn } from "./fixtures";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test.describe("mobile viewport (375 px)", () => {
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
});
