"use client";
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import RiskIndicator from "@/components/domain/RiskIndicator";
import { Badge, Button, EmptyState, ErrorState, LoadingState, Modal, useToast } from "@/components/ui";
import { formatDateTime, localDigits } from "@/lib/intl-locale";
import { NotificationRow, ParcelLine, reportHref, resultHref } from "./parts";
import { useClearSearches, useMarkRead, useNotifications, useReports, useSearches, useWatchlist } from "./useMy";
import WatchButton from "./WatchButton";

const OPEN_LINK =
  "inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

function MyPage({ title, purpose, actions, children }: { title: string; purpose: string; actions?: ReactNode; children: ReactNode }) {
  const tn = useTranslations("my.nav");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader variant="plain" title={title} purpose={purpose} crumbs={[{ label: tn("dashboard"), href: "/my" }]} actions={actions} />
      {children}
    </div>
  );
}

/** Cards, not a table: they read the same at 360 px and on a desktop. */
function CardList({ children, testId }: { children: ReactNode; testId: string }) {
  return <ul data-testid={testId} className="flex flex-col gap-3">{children}</ul>;
}
const CARD = "glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between";

export function MySearches() {
  const t = useTranslations("my.searches");
  const locale = useLocale();
  const toast = useToast();
  const q = useSearches();
  const clear = useClearSearches();
  const [confirm, setConfirm] = useState(false);
  const items = q.data?.items ?? [];

  const onClear = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        setConfirm(false);
        toast("success", t("cleared"));
      },
    });

  return (
    <MyPage
      title={t("title")}
      purpose={t("purpose")}
      actions={items.length > 0 ? <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setConfirm(true)}>{t("clear")}</Button> : undefined}
    >
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={t("empty")} action={<Link href="/verify" className={OPEN_LINK}>{t("emptyAction")}</Link>} />
      ) : (
        <CardList testId="search-history">
          {items.map((s) => (
            <li key={s.land_id} className={CARD}>
              <div className="min-w-0">
                <ParcelLine p={s} />
                <p className="mt-1 text-sm text-ink-muted">
                  {t("lastSearched", { date: formatDateTime(s.last_searched_at, locale, "") })} · {t("count", { count: s.search_count })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WatchButton landId={s.land_id} size="sm" />
                <Link href={resultHref(s.land_id)} className={OPEN_LINK}>
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  {t("open")}
                </Link>
              </div>
            </li>
          ))}
        </CardList>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("clearTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t("cancel")}</Button>
            <Button variant="danger" loading={clear.isPending} onClick={onClear}>{t("clearConfirm")}</Button>
          </>
        }
      >
        <p className="text-ink">{t("clearBody")}</p>
      </Modal>
    </MyPage>
  );
}

export function MyWatchlist() {
  const t = useTranslations("my.watch");
  const locale = useLocale();
  const q = useWatchlist();
  const items = q.data?.items ?? [];
  return (
    <MyPage title={t("title")} purpose={t("purpose")}>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <>
          <p className="text-sm text-ink-muted">{t("used", { count: items.length, limit: q.data.limit })}</p>
          <CardList testId="watchlist">
            {items.map((w) => (
              <li key={w.land_id} className={CARD}>
                <div className="min-w-0">
                  <ParcelLine p={w} />
                  {w.note && <p className="mt-1 text-sm text-ink">{t("note", { note: w.note })}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    {t("since", { date: formatDateTime(w.created_at, locale, "") })}
                    {w.unread > 0 && <Badge tone="review">{t("unread", { count: w.unread })}</Badge>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <WatchButton landId={w.land_id} size="sm" />
                  <Link href={resultHref(w.land_id)} className={OPEN_LINK}>
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    {t("open")}
                  </Link>
                </div>
              </li>
            ))}
          </CardList>
        </>
      )}
    </MyPage>
  );
}

export function MyReports() {
  const t = useTranslations("my.reports");
  const ts = useTranslations("status");
  const tp = useTranslations("my.parcel");
  const locale = useLocale();
  const q = useReports();
  const items = q.data?.items ?? [];
  return (
    <MyPage title={t("title")} purpose={t("purpose")}>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <CardList testId="reports">
          {items.map((r) => {
            const done = r.status === "COMPLETED";
            return (
              <li key={r.id} className={CARD}>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {r.mouza} · <span className="font-normal text-ink-muted">{tp("dag", { dag: localDigits(r.dag_no, locale) })}</span>
                    <span className="ml-2 font-mono text-xs text-ink-muted">{r.land_id}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">{t("made", { date: formatDateTime(r.created_at, locale, "") })}</p>
                  {!done && <p className="mt-1 text-sm text-critical">{r.status === "FAILED" ? t("failed") : ts(r.status)}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {done && <RiskIndicator level={r.risk_level} size="sm" />}
                  {done && (
                    <Link href={reportHref(r.id)} className={OPEN_LINK}>
                      <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      {t("open")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </CardList>
      )}
    </MyPage>
  );
}

export function MyNotifications() {
  const t = useTranslations("my.notes");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const q = useNotifications(unreadOnly);
  const mark = useMarkRead();
  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;
  return (
    <MyPage
      title={t("title")}
      purpose={t("purpose")}
      actions={unread > 0 ? <Button variant="secondary" size="sm" icon={<CheckCheck />} loading={mark.isPending} onClick={() => mark.mutate(undefined)}>{t("markAll")}</Button> : undefined}
    >
      <label className="inline-flex min-h-touch items-center gap-2 self-start text-sm text-ink">
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
        {t("unreadOnly")}
      </label>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={unreadOnly ? t("emptyUnread") : t("empty")} />
      ) : (
        <ul data-testid="notifications" className="glass-card flex flex-col gap-1 p-2">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationRow n={n} onOpen={n.read_at ? undefined : () => mark.mutate([n.id])} />
            </li>
          ))}
        </ul>
      )}
    </MyPage>
  );
}
