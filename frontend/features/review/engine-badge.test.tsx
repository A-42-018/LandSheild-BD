import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import EngineBadge from "./EngineBadge";
import type { ExtractionOut } from "./types";

const base: ExtractionOut = {
  document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "rules", threshold: 0.85,
  fields: [], edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
  validation: { valid: true, errors: [] },
};

function show(over: Partial<ExtractionOut>, messages: any = en, locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <EngineBadge data={{ ...base, ...over }} />
    </NextIntlClientProvider>,
  );
}

describe("EngineBadge", () => {
  it("labels the demo sample", () => {
    show({ ocr_source: "demo", extractor: "mock" });
    expect(screen.getByTestId("badge-source")).toHaveTextContent("Source: Demo sample");
    expect(screen.queryByTestId("badge-extractor")).toBeNull(); // mock extractor is not an engine
    expect(screen.getByTestId("engine-note")).toHaveTextContent("Low-confidence fields are checked by a reviewer.");
  });

  it("shows Tesseract OCR + Rules", () => {
    show({ ocr_source: "tesseract", extractor: "rules" });
    expect(screen.getByTestId("badge-source")).toHaveTextContent("Source: Tesseract OCR");
    expect(screen.getByTestId("badge-extractor")).toHaveTextContent("Extractor: Rules");
  });

  it("shows PDF text + Claude with the model name and fallback warnings", () => {
    show({ ocr_source: "pdf-text", extractor: "claude", model: "claude-haiku-4-5-20251001", warnings: ["PAGES_TRUNCATED", "CLAUDE_FALLBACK:cap"] });
    expect(screen.getByTestId("badge-source")).toHaveTextContent("Source: PDF text");
    expect(screen.getByTestId("badge-extractor")).toHaveTextContent("Extractor: Claude (claude-haiku-4-5-20251001)");
    expect(screen.getByTestId("warning-PAGES_TRUNCATED")).toBeInTheDocument();
    expect(screen.getByTestId("warning-CLAUDE_FALLBACK")).toBeInTheDocument();
  });

  it("says when an old deed was re-read with the old-scan setting", () => {
    show({ ocr_source: "tesseract", extractor: "rules", warnings: ["HISTORICAL_PROFILE"] });
    expect(screen.getByTestId("warning-HISTORICAL_PROFILE")).toHaveTextContent(en.review.engine.warnings.HISTORICAL_PROFILE);
  });

  it("renders nothing for old results without engine data", () => {
    show({});
    expect(screen.queryByTestId("engine-badge")).toBeNull();
  });

  it("is translated to Bangla", () => {
    show({ ocr_source: "tesseract", extractor: "claude" }, bn, "bn");
    expect(screen.getByTestId("badge-source")).toHaveTextContent("উৎস: টেসারেক্ট দিয়ে লেখা পড়া");
    expect(screen.getByTestId("badge-extractor")).toHaveTextContent("পড়ার পদ্ধতি: ক্লড");
  });
});
