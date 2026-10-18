import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { API, apiToken, fillBuyerNid, openEvidenceTab, signIn } from "./fixtures";

// Demo flow (docs/demo-script.md): Doc1 (Rahim → Karim) is recorded, Doc2 (same seller → Hasan)
// conflicts → transaction FLAGGED, HIGH alert on LP-10234. Both documents map to the seeded parcel LP-10234.
const LAND = "LP-10234";
const SAMPLE = (name: string) => path.resolve(__dirname, "../../database/sample_data", name);

/** Upload, then start extraction with the "Start processing" button (Q12-a). */
async function uploadAndProcess(page: Page, file: string): Promise<string> {
  await page.goto("/en/officer/upload");
  await page.locator('input[type="file"]').setInputFiles(SAMPLE(file));
  await expect(page.getByTestId("selected-file")).toBeVisible();
  await fillBuyerNid(page, file);

  const uploaded = page.waitForResponse((r) => r.url().endsWith("/documents/upload") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const res = await uploaded;
  expect(res.status(), "upload status").toBe(201);
  const id = (await res.json()).id as string;
  await expect(page.getByTestId("upload-result")).toBeVisible();

  const started = page.waitForResponse((r) => r.url().endsWith(`/documents/${id}/process`) && r.request().method() === "POST");
  await page.getByTestId("start-processing").click();
  expect((await started).status(), "process status").toBe(202);

  // the page polls the status; the review link appears once processing reaches a terminal state
  await page.getByRole("link", { name: "Open for review" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/officer/review/${id}`));
  await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 30_000 });
  return id;
}

/** Four-eyes rule: the uploader cannot approve, so a reviewer opens the same review page and decides. */
async function approveAsReviewer(page: Page, id: string): Promise<void> {
  await signIn(page, "reviewer");
  await page.goto(`/en/officer/review/${id}`);
  await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 30_000 });
  await approve(page);
}

async function approve(page: Page): Promise<void> {
  const btn = page.getByTestId("approve-btn");
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByTestId("decision-banner")).toContainText("This document has been approved.");
}

test.describe("officer flow (mock providers, seeded database)", () => {
  test.describe.configure({ mode: "serial" });

  test("upload → extraction → edit → approve → conflicting upload → alert → risk report", async ({ page, request }) => {
    await signIn(page, "officer");
    let doc1 = "";
    let doc2 = "";

    await test.step("Doc1: upload, extraction is visible", async () => {
      doc1 = await uploadAndProcess(page, "Doc1.png");
      await expect(page.getByTestId("value-khatian_no")).toHaveText("1245");
      await expect(page.getByTestId("value-dag_no")).toHaveText("785");
      await expect(page.getByTestId("value-seller")).toHaveText("Rahim Uddin");
      await expect(page.getByTestId("value-buyer")).toHaveText("Karim Mia");
    });

    await test.step("edit one field (deed no.), it is marked Edited", async () => {
      await page.getByTestId("edit-deed_no").click();
      await page.getByTestId("input-deed_no").fill("D-2024-0786");
      await page.getByTestId("save-deed_no").click();
      await expect(page.getByTestId("value-deed_no")).toHaveText("D-2024-0786");
      await expect(page.getByTestId("field-deed_no")).toContainText("Edited");
    });

    await test.step("uploader cannot approve their own document (four-eyes)", async () => {
      await expect(page.getByTestId("approve-btn")).toBeDisabled();
      await expect(page.getByTestId("approve-own-upload")).toBeVisible();
      const token = await apiToken(request, "officer");
      const r = await request.post(`${API}/documents/${doc1}/approve`, { headers: { Authorization: `Bearer ${token}` } });
      expect(r.status()).toBe(403);
      expect((await r.json()).code).toBe("SELF_APPROVAL_FORBIDDEN");
    });

    await test.step("reviewer approves Doc1 → recorded, no alert yet", async () => {
      await approveAsReviewer(page, doc1);
      const token = await apiToken(request, "reviewer");
      const r = await request.get(`${API}/risk-alerts?land_id=${LAND}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(r.ok()).toBeTruthy();
      expect((await r.json()).items).toHaveLength(0);
    });

    await test.step("Doc2 (conflicting sale): upload, review, approve", async () => {
      await signIn(page, "officer");
      doc2 = await uploadAndProcess(page, "Doc2.png");
      await expect(page.getByTestId("value-buyer")).toHaveText("Hasan Ali");
      await approveAsReviewer(page, doc2);
    });

    await test.step("dashboard shows a HIGH alert for the parcel", async () => {
      await page.goto("/en/officer");
      const alerts = page.getByTestId("alerts-card");
      await expect(alerts.getByRole("link", { name: LAND }).first()).toBeVisible();
      await expect(alerts.getByText("High", { exact: true }).first()).toBeVisible();
      await expect(alerts.getByText("Possible duplicate transaction", { exact: false }).first()).toBeVisible();
    });

    await test.step("risk result shows HIGH and the report lists the evidence", async () => {
      await page.goto(`/en/verify/result?land_id=${LAND}`);
      await openEvidenceTab(page);
      const risk = page.getByTestId("risk-section");
      await expect(risk).toBeVisible();
      await expect(risk.getByText("High", { exact: true }).first()).toBeVisible();
      const score = Number((await page.getByTestId("risk-score").innerText()).match(/Risk score (\d+) of 100/)?.[1]);
      expect(score).toBeGreaterThanOrEqual(60);

      await page.getByRole("button", { name: "Generate verification report" }).click();
      await expect(page).toHaveURL(/\/en\/report\/.+/);
      await expect(page.getByRole("heading", { name: "Land verification report" })).toBeVisible();
      await expect(page.getByText("Possible duplicate transaction", { exact: false }).first()).toBeVisible();
      await expect(page.getByText("does not establish legal ownership", { exact: false }).first()).toBeVisible();
    });

    await test.step("public QR page shows only the summary with a High level", async () => {
      await page.goto(`/en/v/${LAND}`);
      await expect(page.getByTestId("public-summary")).toBeVisible();
      await expect(page.getByTestId("public-risk")).toContainText("High");
    });
  });
});
