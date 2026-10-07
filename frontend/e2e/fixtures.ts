import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

export const API = "http://localhost:8001/api/v1";
export const PASSWORD = process.env.DEMO_PASSWORD ?? "LandShield2026!";
export type DemoRole = "citizen" | "reviewer" | "officer" | "admin";
export const emailOf = (role: DemoRole) => `${role}@demo.landshield.test`;

/** The access token lives in memory only; the httpOnly refresh cookie (same host, other port) restores the session on page load. */
export async function apiLogin(context: BrowserContext, role: DemoRole): Promise<string> {
  const res = await context.request.post(`${API}/auth/login`, { data: { email: emailOf(role), password: PASSWORD } });
  expect(res.ok(), `API login as ${role} failed (${res.status()})`).toBeTruthy();
  return (await res.json()).access_token as string;
}

/** Bearer token from an isolated request context: does NOT touch the browser's refresh cookie (the page stays signed in as before). */
export async function apiToken(request: APIRequestContext, role: DemoRole): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email: emailOf(role), password: PASSWORD } });
  expect(res.ok(), `API login as ${role} failed (${res.status()})`).toBeTruthy();
  return (await res.json()).access_token as string;
}

/** U6: the risk card lives in the last record tab ("Evidence" / BN equivalent). */
export async function openEvidenceTab(page: Page): Promise<void> {
  await page.getByRole("tab").last().click();
}

export async function signIn(page: Page, role: DemoRole): Promise<void> {
  await apiLogin(page.context(), role);
  // a real sign-in leaves this hint; the page skips the boot-time /auth/refresh without it
  await page.addInitScript(() => window.localStorage.setItem("ls-session", "1"));
}

/** Seeded CLEAN parcel LP-10001 (database/seed/data.json). */
export const CLEAN_LAND = {
  id: "LP-10001",
  district: "Dhaka",
  upazila: "Savar",
  mouza: "Ashulia",
  khatian: "501",
  dag: "101",
};

export async function fillVerifyForm(page: Page, l = CLEAN_LAND): Promise<void> {
  await page.getByLabel("District").selectOption(l.district);
  await page.getByLabel("Upazila").selectOption(l.upazila);
  await page.getByLabel("Mouza").fill(l.mouza);
  await page.getByLabel("Khatian No.").fill(l.khatian);
  await page.getByLabel("Dag No.").fill(l.dag);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
