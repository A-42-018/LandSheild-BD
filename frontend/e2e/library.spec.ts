import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { API, apiToken, fillBuyerNid, signIn } from "./fixtures";

// H7d: an officer uploads the 1944 sample deed, finds it under My uploads, a reviewer approves it, and the
// document page then shows the original, the digital deed, the versions, the hashes and a valid signature;
// the land's Documents section lists it. Needs real OCR like e2e/historical.spec.ts: `npm run e2e:library`.
const SAMPLE = path.resolve(__dirname, "../../database/sample_data/historical/Historical_Land_Deed.pdf");
const FILE = "Historical_Land_Deed.pdf";

test.describe("document library: upload → My uploads → approve → document page (real OCR, rules extractor)", () => {
  test.skip(process.env.E2E_REAL_OCR !== "1", "set E2E_REAL_OCR=1 (npm run e2e:library): needs Tesseract with Bangla data");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("the sample deed is found, approved and opened as original + digital version", async ({ page, request }) => {
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
      await expect(page.getByTestId("extraction-panel")).toBeVisible({ timeout: 60_000 });
    });

    await test.step("the deed is under My uploads, tagged historical, not digitised yet", async () => {
      await page.goto("/en/officer/documents");
      const link = page.getByRole("link", { name: /Open document 4782/ });
      await expect(link).toBeVisible({ timeout: 30_000 });
      const row = link.locator("xpath=ancestor::tr");
      await expect(row).toContainText("Historical");
      await expect(row).toContainText("Not yet");
      await expect(link).toHaveAttribute("href", new RegExp(`/officer/documents/${id}$`));
    });

    await test.step("the document page shows the original and the draft digital deed, and points to the review", async () => {
      await page.goto(`/en/officer/documents/${id}`);
      await expect(page.getByTestId("doc-preview")).toBeVisible();
      await expect(page.getByTestId("deed-view")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("under-review-note")).toBeVisible();
      await expect(page.getByTestId("signature-status")).toHaveAttribute("data-status", "UNSIGNED");
      await expect(page.getByTestId("review-link")).toHaveAttribute("href", new RegExp(`/officer/review/${id}$`));
      await expect(page.locator('[data-testid$="-edit"]')).toHaveCount(0);
    });

    await test.step("a reviewer approves the deed", async () => {
      await signIn(page, "reviewer");
      await page.goto(`/en/officer/review/${id}`);
      await expect(page.getByTestId("deed-view")).toBeVisible({ timeout: 60_000 });
      const btn = page.getByTestId("approve-btn");
      await expect(btn).toBeEnabled();
      await btn.click();
      await expect(page.getByTestId("decision-banner")).toContainText("This document has been approved.");
    });

    await test.step("the document page shows the approved version with hashes, history and a valid signature", async () => {
      await page.goto(`/en/officer/documents/${id}`);
      await expect(page.getByTestId("deed-view")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("review-link")).toHaveCount(0);
      await expect(page.getByTestId("version-status")).toHaveText("Approved");
      await expect(page.getByTestId("signature-status")).toHaveAttribute("data-status", "VALID");
      await expect(page.getByTestId("file-hash")).toHaveText(/^[0-9a-f]{64}$/);
      await expect(page.getByTestId("record-hash")).toHaveText(/^[0-9a-f]{64}$/);
      await expect(page.getByTestId("history-APPROVE")).toBeVisible();
      const token = await apiToken(request, "reviewer");
      const res = await request.get(`${API}/documents/${id}/records`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      await expect(page.getByTestId("file-hash")).toHaveText(body.file_hash);
      expect((body.items as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    await test.step("H8e: the Download menu gives the PDF, JSON, original and bundle of the approved version", async () => {
      await page.goto(`/en/officer/documents/${id}`);
      await expect(page.getByTestId("signature-status")).toHaveAttribute("data-status", "VALID", { timeout: 60_000 });
      const get = async (kind: string) => {
        await page.getByTestId("download-trigger").click();
        const waiting = page.waitForEvent("download");
        await page.getByTestId(`download-${kind}`).click();
        const dl = await waiting;
        const file = await dl.path();
        return { name: dl.suggestedFilename(), bytes: readFileSync(file!) };
      };
      const pdf = await get("pdf");
      expect(pdf.name).toMatch(new RegExp(`^landshield-deed-${id}-v\\d+\\.pdf$`));
      expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
      const json = await get("json");
      expect(json.name).toMatch(/\.json$/);
      expect(JSON.parse(json.bytes.toString("utf8")).record_schema).toBe("lhdr/1");
      const original = await get("original");
      expect(createHash("sha256").update(original.bytes).digest("hex")).toBe(await page.getByTestId("file-hash").innerText());
      const bundle = await get("bundle");
      expect(bundle.name).toMatch(/\.zip$/);
      expect(bundle.bytes.subarray(0, 2).toString()).toBe("PK");
    });

    await test.step("the land's Documents section lists the deed and opens the document page", async () => {
      const token = await apiToken(request, "reviewer");
      const doc = await (await request.get(`${API}/documents/${id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
      expect(doc.land_id, "approval posts the land").toBeTruthy();
      await page.goto(`/en/verify/result?land_id=${doc.land_id}`);
      const section = page.getByTestId("section-documents");
      await section.locator("summary").click();
      const row = page.getByTestId(`land-doc-${id}`);
      await expect(row).toBeVisible();
      await row.getByRole("link").click();
      await expect(page).toHaveURL(new RegExp(`/en/officer/documents/${id}$`));
    });
  });
});
