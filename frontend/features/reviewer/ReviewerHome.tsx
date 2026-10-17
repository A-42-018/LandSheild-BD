"use client";
import { useLocale, useTranslations } from "next-intl";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import PageTip from "@/components/PageTip";
import { Badge } from "@/components/ui";
import { localDigits } from "@/lib/intl-locale";
import MyHistory from "./MyHistory";
import TodayQueue from "./TodayQueue";
import { useTodayQueue } from "./useReviewerData";

/** Reviewer home "আজকের কাজ" (U3.3): the waiting queue first, then my own decisions. */
export default function ReviewerHome() {
  const t = useTranslations("reviewer");
  const locale = useLocale();
  const q = useTodayQueue();
  const total = q.data?.total;
  return (
    <div className="flex flex-col gap-6">
      <OfficerPageHeader
        root
        title={t("title")}
        purpose={t("purpose")}
        meta={total === undefined ? [] : [
          <Badge key="n" tone={total > 0 ? "review" : "verified"} data-testid="pending-count">
            {t("count", { count: total, n: localDigits(total, locale) })}
          </Badge>,
        ]}
      />
      <PageTip page="reviewer" />
      <TodayQueue />
      <MyHistory />
    </div>
  );
}
