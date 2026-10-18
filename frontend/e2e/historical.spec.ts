import path from "node:path";
import { expect, test } from "@playwright/test";
import { API, apiToken, fillBuyerNid, signIn } from "./fixtures";

// H6e: a reviewer corrects and approves the 1944 sample deed in the digital deed form, never touching the
// flat fields. Needs real OCR (the deed has no mock fixture): `npm run e2e:historical`
// (E2E_REAL_OCR=1 -> backend/e2e start script uses Tesseract + rules; needs tesseract, ai/tessdata/ben, the `ai` extra).
const SAMPLE = path.resolve(__dirname, "../../database/sample_data/historical/Historical_Land_Deed.pdf");
const FILE = "Historical_Land_Deed.pdf";

test.describe("historical deed: digital deed form (real OCR, rules extractor)", () => {
  test.skip(process.env.E2E_REAL_OCR !== "1", "set E2E_REAL_OCR=1 (npm run e2e:historical): needs Tesseract with Bangla data");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("upload → historical form → correct → approve → frozen signed record", async ({ page, request }) => {
    let id = "";
    await signIn(page, "officer");

    await test.step("officer uploads the sample deed and starts processing", async () => {
      await page.goto("/en/officer/upload");
      await page.locator('input[type="file"]').setInputFiles(SAMPLE);
      await expect(page.getByTestId("selected-file")).toBeVisible();
      await fillBuyerNid(page, FILE);
      const uploaded = page.waitForResponse((r) => r.url().endsWith("/documents/upload") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Upload", exact: true }).click();
      const res = await uploaded;
      expect(res.status(), "upload status").toBe(201);
      id = (await res.json()).id as string;
      const started = page.waitForResponse((r) => r.url().endsWith(`/documents/${id}/process`) && r.request().method() === "POST");
      await page.getByTestId("start-processing").click();
      expect((await started).status(), "process status").toBe(202);
      await page.getByRole("link", { name: "Open for review" }).click({ timeout: 120_000 });
      await expect(page).toHaveURL(new RegExp(`/en/officer/review/${id}`));
    });

    await test.step("the review screen shows the sectioned digital deed, not 13 flat rows", async () => {
      await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("deed-view")).toBeVisible();
      await expect(page.getByTestId("deed-profile")).toHaveAttribute("data-profile", "historical");
      for (const s of ["registration", "dates", "parties", "consideration", "schedule", "title", "execution"]) {
        await expect(page.getByTestId(`deed-section-${s}`)).toBeVisible();
      }
      await expect(page.getByTestId("deed-deed_no-value")).toContainText("4782");
      await expect(page.getByTestId("core-fields")).not.toHaveAttribute("open", "");
    });

    await test.step("officer corrects a single value and adds a witness (record ops, flat fields untouched)", async () => {
      await page.getByTestId("deed-volume-edit").click();
      await page.getByTestId("deed-volume-input").fill("৩");
      const saved = page.waitForResponse((r) => r.url().endsWith(`/documents/${id}/extraction`) && r.request().method() === "PATCH");
      await page.getByTestId("deed-volume-save").click();
      expect((await saved).status(), "record edit").toBe(200);
      await expect(page.getByTestId("deed-volume-value")).toHaveText("৩");
      await expect(page.getByTestId("deed-volume")).toHaveAttribute("data-edited", "true");

      await page.getByTestId("deed-witness-add-input").fill("নমুনা সাক্ষী");
      const added = page.waitForResponse((r) => r.url().endsWith(`/documents/${id}/extraction`) && r.request().method() === "PATCH");
      await page.getByTestId("deed-witness-add").click();
      expect((await added).status(), "add witness").toBe(200);
      await expect(page.getByTestId("deed-witness0_name-value")).toHaveText("নমুনা সাক্ষী");
    });

    await test.step("edits survive a reload", async () => {
      await page.reload();
      await expect(page.getByTestId("deed-view")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("deed-volume-value")).toHaveText("৩");
      await expect(page.getByTestId("deed-witness0_name-value")).toHaveText("নমুনা সাক্ষী");
    });

    await test.step("four-eyes: the uploader cannot approve", async () => {
      await expect(page.getByTestId("approve-btn")).toBeDisabled();
      await expect(page.getByTestId("approve-own-upload")).toBeVisible();
    });

    await test.step("a reviewer sees the corrected form and approves it", async () => {
      await signIn(page, "reviewer");
      await page.goto(`/en/officer/review/${id}`);
      await expect(page.getByTestId("deed-view")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("deed-volume-value")).toHaveText("৩");
      const btn = page.getByTestId("approve-btn");
      await expect(btn).toBeEnabled();
      await btn.click();
      await expect(page.getByTestId("decision-banner")).toContainText("This document has been approved.");
    });

    await test.step("the approved record is frozen, hashed and signed; the original is kept", async () => {
      const token = await apiToken(request, "reviewer");
      const res = await request.get(`${API}/documents/${id}/records`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const approved = (body.items as { status: string; signature_status: string; record_hash: string | null }[]).filter((r) => r.status === "APPROVED");
      expect(approved).toHaveLength(1);
      expect(approved[0].signature_status).toBe("VALID");
      expect(approved[0].record_hash).toBeTruthy();
      const file = await request.get(`${API}/documents/${id}/file`, { headers: { Authorization: `Bearer ${token}` } });
      expect(file.ok()).toBeTruthy();
      expect(file.headers()["x-file-sha256"]).toBe(body.file_hash);
    });
  });
});
