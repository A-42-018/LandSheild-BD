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

/** U2.4: the risk card lives in the last collapsible section ("Evidence" / BN equivalent); it opens itself when there is evidence, so only open it if closed. */
export async function openEvidenceTab(page: Page): Promise<void> {
  const section = page.getByTestId("section-evidence");
  await section.waitFor();
  if ((await section.getAttribute("open")) === null) await section.locator("summary").click();
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

/** Synthetic owner NIDs from database/seed/data.json: the buyer named on each sample deed. */
export const BUYER_NID: Record<string, { nid: string; dob: string }> = {
  "Doc1.png": { nid: "19809990000000002", dob: "1980-07-01" }, // Karim Mia
  "Doc2.png": { nid: "19689990000000003", dob: "1968-11-23" }, // Hasan Ali
  // H6e: synthetic NID for the buyer of the 1944 sample deed (a new owner, not in the seed)
  "Historical_Land_Deed.pdf": { nid: "19109990000000009", dob: "1910-03-14" },
};

/** The district each sample deed lies in: the upload files it under that district's land office. */
const SAMPLE_DISTRICT: Record<string, string> = { "Doc1.png": "Gazipur", "Doc2.png": "Gazipur" };

/**
 * Every upload names a land office, and the record must lie in that office's area. The demo officer has
 * no office of their own, so pick the sample's district (Dhaka division) and its first district-level
 * office; a district office takes records from any of its upazilas.
 */
export async function pickOffice(page: Page, file: string): Promise<void> {
  const box = page.getByTestId("office-sortlist");
  if (await box.getByTestId("my-office").isVisible()) return; // an office officer files into their own office
  await box.getByLabel("Division").selectOption("Dhaka");
  await box.getByLabel("Zila (District)").selectOption(SAMPLE_DISTRICT[file] ?? "Dhaka");
  const office = box.getByLabel("Land office");
  await expect(office).toBeEnabled();
  await expect(office.locator("option")).not.toHaveCount(1); // the placeholder alone: still loading
  await office.selectOption({ index: 1 });
}

/** A deed is approved only with the new owner's NID, so the upload form asks for it. */
export async function fillBuyerNid(page: Page, file: string): Promise<void> {
  const owner = BUYER_NID[file];
  if (!owner) return;
  const box = page.getByTestId("party-nid-buyer");
  await box.getByLabel("NID number").fill(owner.nid);
  await box.getByLabel("Date of birth").fill(owner.dob);
}
