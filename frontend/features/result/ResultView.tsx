"use client";
import { useLocale, useTranslations } from "next-intl";
import { Info, Network, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import PageHeader from "@/components/PageHeader";
import { PlotSearchArt } from "@/features/landing/Illustrations";
import { Link } from "@/i18n/navigation";
import ReadAloud from "@/components/ReadAloud";
import { ApiError } from "@/lib/api";
import { useStickyBar } from "@/lib/sticky-bar";
import { useAuth } from "@/features/auth/AuthContext";
import { hasRole, REVIEW_UP } from "@/features/auth/roles";
import LandDocuments from "@/features/library/LandDocuments";
import { useLandDocuments } from "@/features/library/useDocumentPage";
import { localDigits } from "@/lib/intl-locale";
import LandInfoCard from "./LandInfoCard";
import OwnershipTimeline from "./OwnershipTimeline";
import TransactionsTable from "./TransactionsTable";
import MutationTable from "./MutationTable";
import EncumbranceTable from "./EncumbranceTable";
import { formatDate } from "./format";
import Section from "./Section";
import Verdict from "./Verdict";
import RiskCard from "@/features/risk/RiskCard";
import GenerateReportButton from "@/features/report/GenerateReportButton";
import WatchButton from "@/features/my/WatchButton";
import type { RiskAssessment } from "@/features/risk/types";
import type { EncumbranceEntry, LandInfo, MutationEntry, OwnershipEntry, TransactionEntry } from "./types";

/** One section body: loading → error with retry → content. */
function tabPanel(q: Pick<UseQueryResult, "isPending" | "isError" | "error" | "refetch">, render: () => React.ReactNode, err: string) {
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} message={err} onRetry={() => void q.refetch()} />;
  return render();
}

export default function ResultView({ landId }: { landId?: string }) {
  const t = useTranslations();
  const barRef = useStickyBar();
  const locale = useLocale();
  const { api, user } = useAuth();
  // H7d: the land's documents are for staff (the endpoint answers citizens with 403)
  const staff = hasRole(user?.role, REVIEW_UP);
  const docs = useLandDocuments(landId, staff);
  const enc = landId ? encodeURIComponent(landId) : "";
  const enabled = Boolean(landId);

  const land = useQuery({ queryKey: ["land", landId], enabled, retry: false, queryFn: () => api.get<LandInfo>(`/lands/${enc}`) });
  const own = useQuery({
    queryKey: ["land", landId, "ownership"],
    enabled,
    retry: false,
    queryFn: () => api.get<{ entries: OwnershipEntry[] }>(`/lands/${enc}/ownership`),
  });
  const tx = useQuery({
    queryKey: ["land", landId, "transactions"],
    enabled,
    retry: false,
    queryFn: () => api.get<{ transactions: TransactionEntry[] }>(`/lands/${enc}/transactions`),
  });

  const mut = useQuery({
    queryKey: ["land", landId, "mutations"],
    enabled,
    retry: false,
    queryFn: () => api.get<{ mutations: MutationEntry[] }>(`/lands/${enc}/mutations`),
  });

  const encs = useQuery({
    queryKey: ["land", landId, "encumbrances"],
    enabled,
    retry: false,
    queryFn: () => api.get<{ encumbrances: EncumbranceEntry[] }>(`/lands/${enc}/encumbrances`),
  });

  const risk = useQuery({
    queryKey: ["land", landId, "risk"],
    enabled,
    retry: false,
    queryFn: () => api.get<RiskAssessment>(`/lands/${enc}/risk`),
  });

  const back = (
    <Link href="/verify" className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline">
      <Search aria-hidden="true" className="h-4 w-4" />
      {t("result.newSearch")}
    </Link>
  );

  const banner = (
    <p role="note" className="glass-card flex items-center gap-2 border-l-[3px] border-l-review px-4 py-2 text-sm font-medium text-ink">
      <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-review" />
      {t("common.demoLabel")}
    </p>
  );

  let body: React.ReactNode;
  if (!landId) {
    body = <EmptyState title={t("result.notFound")} description={t("result.notFoundHint")} action={back} />;
  } else if (land.isPending) {
    body = <LoadingState />;
  } else if (land.isError) {
    const e = land.error;
    body =
      e instanceof ApiError && (e.status === 404 || e.code === "LAND_NOT_FOUND") ? (
        <EmptyState title={t("result.notFound")} description={t("result.notFoundHint")} action={back} />
      ) : (
        <ErrorState error={e} message={t("result.loadError")} onRetry={() => void land.refetch()} />
      );
  } else {
    const lerr = t("result.loadError");
    const n = (count: number | undefined) => (count === undefined ? undefined : localDigits(count, locale));
    body = (
      <div id="result-readable" className="flex flex-col gap-4">
        <ReadAloud targetId="result-readable" subject={t("readAloud.subjectResult")} className="self-start" />
        <Verdict risk={risk} />
        <section aria-labelledby="result-details" className="flex flex-col gap-2">
          <h2 id="result-details" className="text-lg font-bold text-ink">{t("result.detailsTitle")}</h2>
          <p className="text-sm text-ink-muted">{t("result.detailsHint")}</p>
          <div role="group" aria-label={t("page.recordTabs")} className="flex flex-col gap-2">
            <Section title={t("result.landInfo")} defaultOpen testId="section-land">
              <LandInfoCard land={land.data} bare />
            </Section>
            <Section title={t("result.tabOwnership")} count={n(own.data?.entries?.length)} testId="section-ownership">
              {tabPanel(own, () => <OwnershipTimeline entries={own.data?.entries ?? []} staff={staff} />, lerr)}
            </Section>
            <Section title={t("result.tabTransactions")} count={n(tx.data?.transactions?.length)} testId="section-transactions">
              {tabPanel(tx, () => <TransactionsTable transactions={tx.data?.transactions ?? []} />, lerr)}
            </Section>
            <Section title={t("result.tabMutation")} count={n(mut.data?.mutations?.length)} testId="section-mutation">
              {tabPanel(mut, () => <MutationTable mutations={mut.data?.mutations ?? []} />, lerr)}
            </Section>
            <Section title={t("result.tabEncumbrance")} count={n(encs.data?.encumbrances?.length)} testId="section-encumbrance">
              {tabPanel(encs, () => <EncumbranceTable items={encs.data?.encumbrances ?? []} />, lerr)}
            </Section>
            {staff && landId && (
              <Section title={t("result.tabDocuments")} count={n(docs.data?.total)} testId="section-documents">
                <LandDocuments landId={landId} />
              </Section>
            )}
            {/* Remount once the assessment arrives so the section opens by itself when there is something to read. */}
            <Section
              key={risk.data ? "ready" : "wait"}
              title={t("result.tabEvidence")}
              count={n(risk.data?.evidence?.length)}
              defaultOpen={Boolean(risk.data?.evidence?.length)}
              testId="section-evidence"
            >
              <div className="flex flex-col gap-3">
                {tabPanel(risk, () => risk.data && <RiskCard risk={risk.data} />, t("risk.loadError"))}
                <Link href={`/verify/graph?land_id=${enc}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline">
                  <Network aria-hidden="true" className="h-4 w-4" />
                  {t("graph.viewLink")}
                </Link>
              </div>
            </Section>
          </div>
        </section>
        <p className="text-sm text-ink-muted">{t("risk.disclaimer")}</p>
        <div ref={barRef} data-no-speech data-sticky-bar className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:rounded-card sm:border sm:shadow-glass print:hidden">
          <div className="flex flex-wrap items-start gap-3">
            <GenerateReportButton landId={land.data.land_id} />
            <WatchButton landId={land.data.land_id} />
          </div>
          {back}
        </div>
      </div>
    );
  }

  const meta = land.data
    ? [
        t("page.dataAsOf", { date: formatDate(new Date(land.dataUpdatedAt).toISOString(), locale, "") }),
        <span key="ref" className="font-mono">{t("page.ref", { ref: land.data.land_id })}</span>,
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("result.title")}
        purpose={t("page.resultPurpose")}
        art={<PlotSearchArt />}
        crumbs={[{ label: t("nav.verify"), href: "/verify" }]}
        meta={meta}
      />
      {banner}
      {body}
    </div>
  );
}
