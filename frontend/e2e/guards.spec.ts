import { expect, test } from "@playwright/test";
import { API, apiLogin, signIn } from "./fixtures";

const STAFF_PAGES = ["/en/officer", "/en/officer/upload", "/en/officer/audit-logs", "/en/admin"];

test.describe("anonymous visitors", () => {
  for (const path of STAFF_PAGES) {
    test(`${path} → login with next=`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en\/officer-login\?next=/);
      await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
    });
  }

  test("API rejects anonymous calls", async ({ request }) => {
    for (const p of ["/officer/stats", "/admin/users", "/admin/audit-logs", "/lands/LP-10001"]) {
      expect((await request.get(`${API}${p}`)).status(), p).toBe(401);
    }
  });
});

test.describe("citizen is blocked from staff areas", () => {
  for (const path of STAFF_PAGES) {
    test(`${path} → permission message`, async ({ page }) => {
      await signIn(page, "citizen");
      await page.goto(path);
      await expect(page.getByText("You don't have permission to perform this action.").first()).toBeVisible();
    });
  }

  test("API answers 403 to a citizen token", async ({ context, request }) => {
    const token = await apiLogin(context, "citizen");
    const headers = { Authorization: `Bearer ${token}` };
    for (const p of ["/officer/stats", "/officer/queue", "/admin/users", "/admin/audit-logs"]) {
      expect((await request.get(`${API}${p}`, { headers })).status(), p).toBe(403);
    }
  });
});

test.describe("role ladder", () => {
  test("officer reaches the dashboard but not the admin console", async ({ page }) => {
    await signIn(page, "officer");
    await page.goto("/en/officer");
    await expect(page.getByRole("heading", { name: "Officer dashboard" })).toBeVisible();
    await page.goto("/en/admin");
    await expect(page.getByText("You don't have permission to perform this action.").first()).toBeVisible();
  });

  test("admin reaches the admin console", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/en/admin");
    await expect(page.getByText("You don't have permission to perform this action.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  });

  test("reviewer cannot upload", async ({ page }) => {
    await signIn(page, "reviewer");
    await page.goto("/en/officer/upload");
    await expect(page.getByText("You don't have permission to perform this action.").first()).toBeVisible();
  });
});

test.describe("citizen area /my (U3.2)", () => {
  test("anonymous → citizen sign-in with next=", async ({ page }) => {
    await page.goto("/en/my/watchlist");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fmy%2Fwatchlist/);
  });

  test("citizen sees their dashboard", async ({ page }) => {
    await signIn(page, "citizen");
    await page.goto("/en/my");
    await expect(page.getByRole("heading", { level: 1, name: /^Hello, / })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "My land services" })).toBeVisible();
  });

  test("staff get the permission message", async ({ page }) => {
    await signIn(page, "officer");
    await page.goto("/en/my");
    await expect(page.getByText("You don't have permission to perform this action.").first()).toBeVisible();
  });
});
