import { expect, test } from "@playwright/test";
import { CLEAN_LAND, fillVerifyForm, signIn } from "./fixtures";

test.describe("citizen verifies a clean parcel", () => {
  test("form → result (LOW risk) → report", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/verify");
    await fillVerifyForm(page);

    await expect(page).toHaveURL(new RegExp(`/en/verify/result\\?land_id=${CLEAN_LAND.id}`));
    await expect(page.getByRole("heading", { name: "Verification result" })).toBeVisible();
    await expect(page.getByText(CLEAN_LAND.id).first()).toBeVisible();

    const risk = page.getByTestId("risk-section");
    await expect(risk).toBeVisible();
    await expect(page.getByTestId("risk-score")).toHaveText("0");
    await expect(risk.getByText("Low", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Generate verification report" }).click();
    await expect(page).toHaveURL(/\/en\/report\/.+/);
    await expect(page.getByRole("heading", { name: "Land verification report" })).toBeVisible();
    await expect(page.getByText("does not establish legal ownership", { exact: false }).first()).toBeVisible();
  });

  test("unknown parcel shows the not-found message, no crash", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/verify");
    await fillVerifyForm(page, { ...CLEAN_LAND, khatian: "999999", dag: "888888" });
    await expect(page.getByRole("alert")).toContainText("No records found.");
  });
});
