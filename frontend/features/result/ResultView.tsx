"use client";
import { useLocale, useTranslations } from "next-intl";
import { Info, Network, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, Tabs } from "@/components/ui";
import PageHeader from "@/components/PageHeader";
import { PlotSearchArt } from "@/features/landing/Illustrations";
import RiskIndicator from "@/components/domain/RiskIndicator";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import LandInfoCard from "./LandInfoCard";
import OwnershipTimeline from "./OwnershipTimeline";
import TransactionsTable from "./TransactionsTable";
import MutationTable from "./MutationTable";
import EncumbranceTable from "./EncumbranceTable";
import { formatDate } from "./format";
import RiskCard from "@/features/risk/RiskCard";
import GenerateReportButton from "@/features/report/GenerateReportButton";
import WatchButton from "@/features/my/WatchButton";
import type { RiskAssessment } from "@/features/risk/types";
import type { EncumbranceEntry, LandInfo, MutationEntry, OwnershipEntry, TransactionEntry } from "./types";

/** One tab panel: loading → error with retry → content. */
function tabPanel(q: Pick<UseQueryResult, "isPending" | "isError" | "refetch">, render: () => React.ReactNode, err: string) {
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState message={err} onRetry={() => void q.refetch()} />;
  return render();
}

export default function ResultView({ landId }: { landId?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { api } = useAuth();
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
    body = <EmptyState title={t("common.empty")} action={back} />;
  } else if (land.isPending) {
    body = <LoadingState />;
  } else if (land.isError) {
    const e = land.error;
    body =
      e instanceof ApiError && (e.status === 404 || e.code === "LAND_NOT_FOUND") ? (
        <EmptyState title={t("common.empty")} action={back} />
      ) : (
        <ErrorState
          message={e instanceof ApiError && e.status === 403 ? t("errors.permission") : t("result.loadError")}
          onRetry={() => void land.refetch()}
        />
      );
  } else {
    const lerr = t("result.loadError");
    body = (
      <>
        <LandInfoCard land={land.data} chip={risk.data ? <RiskIndicator level={risk.data.risk_level} /> : undefined} />
        <Tabs
          sticky
          label={t("page.recordTabs")}
          tabs={[
            { id: "ownership", label: t("result.tabOwnership"), content: tabPanel(own, () => <OwnershipTimeline entries={own.data?.entries ?? []} />, lerr) },
            { id: "transactions", label: t("result.tabTransactions"), content: tabPanel(tx, () => <TransactionsTable transactions={tx.data?.transactions ?? []} />, lerr) },
            { id: "mutation", label: t("result.tabMutation"), content: tabPanel(mut, () => <MutationTable mutations={mut.data?.mutations ?? []} />, lerr) },
            { id: "encumbrance", label: t("result.tabEncumbrance"), content: tabPanel(encs, () => <EncumbranceTable items={encs.data?.encumbrances ?? []} />, lerr) },
            {
              id: "evidence",
              label: t("result.tabEvidence"),
              content: (
                <div className="flex flex-col gap-3">
                  {tabPanel(risk, () => risk.data && <RiskCard risk={risk.data} />, t("risk.loadError"))}
                  <Link href={`/verify/graph?land_id=${enc}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline">
                    <Network aria-hidden="true" className="h-4 w-4" />
                    {t("graph.viewLink")}
                  </Link>
                </div>
              ),
            },
          ]}
        />
        <p className="text-sm text-ink-muted">{t("risk.disclaimer")}</p>
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:rounded-card sm:border sm:shadow-glass print:hidden">
          <div className="flex flex-wrap items-start gap-3">
            <GenerateReportButton landId={land.data.land_id} />
            <WatchButton landId={land.data.land_id} />
          </div>
          {back}
        </div>
      </>
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
