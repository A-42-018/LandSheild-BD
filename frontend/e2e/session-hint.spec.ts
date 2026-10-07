import { expect, test } from "@playwright/test";

test.describe("silent session restore", () => {
  test("a signed-out visitor produces no console error and no /auth/refresh call", async ({ page }) => {
    const errors: string[] = [];
    const refreshes: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("request", (r) => r.url().endsWith("/auth/refresh") && refreshes.push(r.url()));
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    expect(refreshes).toEqual([]);
  });

  test("a signed-in browser is restored after reload; after sign-out it is anonymous again", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel("Email").fill("officer@demo.landshield.test");
    await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD ?? "LandShield2026!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/en\/?$/);
    await page.reload();
    await page.goto("/en/officer");
    await expect(page.getByTestId("alerts-card")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.goto("/en/officer");
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => window.localStorage.getItem("ls-session"))).toBeNull();
  });
});
