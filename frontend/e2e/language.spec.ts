import { expect, test } from "@playwright/test";
import { signIn } from "./fixtures";

test.describe("EN ↔ BN switch", () => {
  test("login page keeps its path and translates", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByRole("link", { name: "বাংলা" }).click();
    await expect(page).toHaveURL(/\/bn\/login/);
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByRole("heading", { name: "সাইন ইন" })).toBeVisible();
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("signed-in session survives the switch; brand name stays English", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/verify");
    await expect(page.getByRole("heading", { name: "Verify Land" })).toBeVisible();
    await page.getByRole("link", { name: "বাংলা" }).click();
    await expect(page).toHaveURL(/\/bn\/verify/);
    await expect(page.getByRole("heading", { name: "ভূমি যাচাই" })).toBeVisible();
    await expect(page).toHaveTitle(/LandShield BD/);
  });
});
