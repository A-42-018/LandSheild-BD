"use client";
import { useLocale, useTranslations } from "next-intl";
import { Check, Circle, History } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate } from "./format";
import type { OwnershipEntry } from "./types";
import { intlLocale } from "@/lib/intl-locale";

export default function OwnershipTimeline({ entries }: { entries: OwnershipEntry[] }) {
  const t = useTranslations("result");
  const locale = useLocale();
  const unknown = t("unknownDate");
  return (
    <Card title={t("ownership")} icon={<History />}>
      {entries.length === 0 ? (
        <EmptyState title={t("noOwnership")} />
      ) : (
        <ol aria-label={t("ownership")} className="flex flex-col">
          {entries.map((e, i) => (
            <li
              key={`${e.owner.name}-${e.start_date ?? i}-${i}`}
              className={`relative ms-4 border-l-2 border-dashed pb-5 ps-7 last:pb-0 ${e.is_current ? "border-verified/50" : "border-line"}`}
            >
              <span
                aria-hidden="true"
                className={`absolute -left-[17px] top-0 inline-flex h-8 w-8 items-center justify-center rounded-xl border-2 bg-surface ${
                  e.is_current ? "border-verified text-verified" : "border-line text-pending"
                }`}
              >
                {e.is_current ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{e.owner.name}</span>
                {e.is_current && <Badge tone="verified">{t("current")}</Badge>}
              </div>
              {e.owner.father_name && (
                <p className="text-sm text-ink-muted">
                  {t("fatherName")}: {e.owner.father_name}
                </p>
              )}
              <p className="text-sm text-ink-muted">
                {formatDate(e.start_date, locale, unknown)} – {e.end_date ? formatDate(e.end_date, locale, unknown) : t("present")}
              </p>
              {(e.confidence != null || e.document) && (
                <p className="text-xs text-ink-muted">
                  {e.confidence != null && (
                    <span>
                      {t("confidence")}: {new Intl.NumberFormat(intlLocale(locale), { style: "percent" }).format(e.confidence)}
                    </span>
                  )}
                  {e.confidence != null && e.document && " · "}
                  {e.document && (
                    <span>
                      {t("sourceDocument")}: {e.document.type}
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
