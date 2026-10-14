"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import { applyTextSize, readTextSize, saveTextSize, TEXT_SIZES, type TextSize } from "@/lib/theme";

const BTN =
  "inline-flex min-h-8 min-w-8 items-center justify-center rounded px-1.5 font-semibold text-white/95 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50";

/** Top strip (U3, roadmap 4.5 item 1): demo notice (left); text-size A- A A+ and language (right). */
export default function TopStrip() {
  const t = useTranslations("strip");
  const [size, setSize] = useState<TextSize>(100);

  useEffect(() => setSize(readTextSize()), []);

  const choose = (s: TextSize) => {
    setSize(s);
    saveTextSize(s);
    applyTextSize(s);
  };
  const idx = TEXT_SIZES.indexOf(size);

  return (
    <div className="bg-strip text-[13px] text-white/95 print:hidden" data-testid="top-strip">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-0.5">
        <p className="py-1">{t("notice")}</p>
        <div className="flex items-center gap-3">
          <div role="group" aria-label={t("textSize")} className="inline-flex items-center gap-0.5">
            <button type="button" aria-label={t("smaller")} title={t("smaller")} disabled={idx <= 0} onClick={() => choose(TEXT_SIZES[idx - 1])} className={BTN}>
              <span aria-hidden="true" className="text-xs">{t("glyphSmaller")}</span>
            </button>
            <button type="button" aria-label={t("normal")} title={t("normal")} aria-pressed={size === 100} onClick={() => choose(100)} className={BTN}>
              <span aria-hidden="true">{t("glyphNormal")}</span>
            </button>
            <button type="button" aria-label={t("larger")} title={t("larger")} disabled={idx >= TEXT_SIZES.length - 1} onClick={() => choose(TEXT_SIZES[idx + 1])} className={BTN}>
              <span aria-hidden="true" className="text-base">{t("glyphLarger")}</span>
            </button>
          </div>
          <LanguageSwitcher variant="strip" />
        </div>
      </div>
    </div>
  );
}
