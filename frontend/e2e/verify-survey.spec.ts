import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** SJ8: survey / JL / sheet on the public Verify form (docs/survey-jl-roadmap.md D3–D7).
 *  Needs the demo seed (LP-12001..3) and MOUZA_ENABLED_DIVISION_ID=3, as e2e/start-backend.sh sets up. */
const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../messages/en.json"), "utf8"));
const lbl = (s: string) => new RegExp(`^${s}(\\s|\\*|$)`);

async function fill(page: Page, o: { survey: string; jl?: string; sheet?: string; khatian: string; dag: string }) {
  await page.goto("/en", { waitUntil: "networkidle" });
  const form = page.getByRole("form", { name: en.verify.title });
  await form.getByLabel(lbl(en.verify.district)).selectOption("Dhaka");
  await form.getByLabel(lbl(en.verify.upazila)).selectOption("Savar");
  await form.getByLabel(lbl(en.verify.mouza)).fill("Ashulia");
  await form.getByLabel(lbl(en.verify.survey)).selectOption(o.survey);
  if (o.jl) {
    await form.getByRole("button", { name: en.verify.jlEdit }).click();
    await form.getByLabel(lbl(en.verify.jlNo)).fill(o.jl);
  }
  if (o.sheet) {
    await form.getByText(en.verify.moreDetails).click();
    await form.getByLabel(lbl(en.verify.sheetNo)).fill(o.sheet);
  }
  await form.getByLabel(lbl(en.verify.khatian)).fill(o.khatian);
  await form.getByLabel(lbl(en.verify.dag)).fill(o.dag);
  await form.getByRole("button", { name: en.verify.submit }).click();
}

test("same khatian/dag in two surveys: chooser, then the picked record", async ({ page }) => {
  await fill(page, { survey: "CS", khatian: "501", dag: "101" });
  const chooser = page.getByTestId("ambiguous-chooser");
  await expect(chooser).toBeVisible();
  await expect(chooser.getByTestId("chooser-option").first()).toBeVisible();
  await chooser.getByTestId("chooser-option").first().click();
  await expect(page.getByTestId("public-summary")).toBeVisible();
});

test("a JL that does not belong to the mouza is an error, not a record", async ({ page }) => {
  await fill(page, { survey: "RS", jl: "99", khatian: "1410", dag: "1010" });
  await expect(page.getByText(en.verify.errors.jlMismatch)).toBeVisible();
  await expect(page.getByTestId("public-summary")).toHaveCount(0);
});

test("a wrong map sheet still shows the record, with an amber warning", async ({ page }) => {
  await fill(page, { survey: "RS", jl: "45", sheet: "9", khatian: "1410", dag: "1010" });
  await expect(page.getByTestId("public-summary")).toBeVisible();
  await expect(page.getByTestId("sheet-warning")).toBeVisible();
});
