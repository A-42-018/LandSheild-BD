"use client";
import { Contrast } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import { formatDates, type DateLabels } from "@/lib/bn-date";
import {
  applyContrast,
  applyTextSize,
  readContrast,
  readTextSize,
  saveContrast,
  saveTextSize,
  TEXT_SIZES,
  type TextSize,
} from "@/lib/theme";

const BTN =
  "inline-flex min-h-8 min-w-8 [@media(pointer:coarse)]:min-h-touch [@media(pointer:coarse)]:min-w-touch items-center justify-center rounded px-1.5 font-semibold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-white/20";

/** Top strip (U1.1): today's Bangla + Gregorian date on the left; text size A− A A+, high contrast and the বাং | EN pill on the right.
 *  Not sticky: it scrolls away so the main header keeps its height. */
export default function TopStrip() {
  const t = useTranslations("strip");
  const locale = useLocale();
  const [dates, setDates] = useState<DateLabels | null>(null);
  const [size, setSize] = useState<TextSize>(100);
  const [contrast, setContrast] = useState(false);

  // Date and saved choices are read after mount: the server render is static and must not bake in a date.
  useEffect(() => {
    setDates(formatDates(new Date(), locale));
    setSize(readTextSize());
    setContrast(readContrast());
  }, [locale]);

  const chooseSize = (s: TextSize) => {
    setSize(s);
    saveTextSize(s);
    applyTextSize(s);
  };
  const toggleContrast = () => {
    setContrast(!contrast);
    saveContrast(!contrast);
    applyContrast(!contrast);
  };
  const idx = TEXT_SIZES.indexOf(size);

  return (
    <div role="region" aria-label={t("label")} data-testid="top-strip" className="border-b border-white/10 bg-[#06271B] text-[0.8125rem] text-white print:hidden">
      <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1">
        <p className="min-h-6 py-0.5">
          {dates && (
            <>
              <span className="sr-only">{t("today")}: </span>
              <span className="hidden sm:inline">{dates.weekday} · </span>
              <span className="font-semibold">{dates.bangla}</span>
              <span className="hidden text-white/80 md:inline"> · {dates.gregorian}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <div role="group" aria-label={t("textSize")} className="inline-flex items-center gap-0.5">
            <button type="button" aria-label={t("smaller")} title={t("smaller")} disabled={idx <= 0} onClick={() => chooseSize(TEXT_SIZES[idx - 1])} className={BTN}>
              <span aria-hidden="true" className="text-xs">{t("glyphSmaller")}</span>
            </button>
            <button type="button" aria-label={t("normal")} title={t("normal")} aria-pressed={size === 100} onClick={() => chooseSize(100)} className={BTN}>
              <span aria-hidden="true">{t("glyphNormal")}</span>
            </button>
            <button type="button" aria-label={t("larger")} title={t("larger")} disabled={idx >= TEXT_SIZES.length - 1} onClick={() => chooseSize(TEXT_SIZES[idx + 1])} className={BTN}>
              <span aria-hidden="true" className="text-base">{t("glyphLarger")}</span>
            </button>
          </div>
          <button type="button" aria-pressed={contrast} aria-label={t("contrast")} title={t("contrast")} onClick={toggleContrast} className={BTN}>
            <Contrast aria-hidden="true" className="h-4 w-4" />
          </button>
          <LanguageSwitcher variant="strip" />
        </div>
      </div>
    </div>
  );
}
