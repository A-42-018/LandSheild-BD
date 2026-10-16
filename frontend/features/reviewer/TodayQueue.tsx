"use client";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Clock, ListChecks } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import RiskIndicator from "@/components/domain/RiskIndicator";
import { Badge, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { localDigits } from "@/lib/intl-locale";
import type { QueueItem } from "@/features/officer/types";
import { AGE_TONE, ageBand, ageDays, type AgeBand } from "./ageing";
import { useTodayQueue } from "./useReviewerData";

const LINK_PRIMARY = "inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BAND_ICON: Record<AgeBand, typeof Clock> = { fresh: CheckCircle2, aging: Clock, late: AlertTriangle };

function AgeChip({ createdAt }: { createdAt: string }) {
  const t = useTranslations("reviewer.queue");
  const locale = useLocale();
  const days = ageDays(createdAt);
  const band = ageBand(days);
  const Icon = BAND_ICON[band];
  return (
    <Badge tone={AGE_TONE[band]} icon={<Icon aria-hidden="true" className="h-3.5 w-3.5" />} data-band={band}>
      {days === 0 ? t("age.today") : t("age.days", { days: localDigits(days, locale), count: days })}
      <span className="sr-only"> · {t(`band.${band}`)}</span>
    </Badge>
  );
}

function Row({ item, first }: { item: QueueItem; first: boolean }) {
  const t = useTranslations("reviewer.queue");
  const tt = useTranslations("upload.types");
  const name = item.land_id ?? t("noLand");
  const type = ["DEED", "KHATIAN", "PORCHA", "MUTATION", "OTHER"].includes(item.document_type) ? tt(item.document_type) : item.document_type;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface p-3" data-testid="today-row">
      <AgeChip createdAt={item.created_at} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{name}</p>
        <p className="text-sm text-ink-muted">{type}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.low_confidence && <Badge tone="review">{t("lowConfidence")}</Badge>}
        {item.high_risk && <RiskIndicator level="HIGH" size="sm" showLabel={false} />}
      </div>
      <Link
        href={`/officer/review/${item.id}`}
        aria-label={t("openRow", { name })}
        className={first ? LINK_PRIMARY : "inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"}
      >
        {t("review")}
      </Link>
    </li>
  );
}

export default function TodayQueue() {
  const t = useTranslations("reviewer.queue");
  const te = useTranslations("errors");
  const locale = useLocale();
  const q = useTodayQueue();

  let body;
  if (q.isLoading) body = <LoadingState />;
  else if (q.isError || !q.data) {
    body = <ErrorState message={q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined} onRetry={() => q.refetch()} />;
  } else if (q.data.items.length === 0) {
    body = <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />;
  } else {
    const { items, total } = q.data;
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul aria-label={t("legend")} className="flex flex-wrap gap-2 text-xs">
            {(["fresh", "aging", "late"] as const).map((b) => (
              <li key={b}><Badge tone={AGE_TONE[b]} dot>{t(`legendItem.${b}`)}</Badge></li>
            ))}
          </ul>
          <Link href={`/officer/review/${items[0].id}`} data-testid="start-oldest" className={LINK_PRIMARY}>
            {t("startOldest")}
          </Link>
        </div>
        <ol className="flex flex-col gap-2" aria-label={t("title")}>
          {items.map((it, i) => <Row key={it.id} item={it} first={i === 0} />)}
        </ol>
        {total > items.length && <p className="text-sm text-ink-muted">{t("more", { shown: localDigits(items.length, locale), total: localDigits(total, locale) })}</p>}
      </div>
    );
  }
  return (
    <Card title={t("title")} icon={<ListChecks />}>
      {body}
    </Card>
  );
}
