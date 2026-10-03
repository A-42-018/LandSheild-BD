"use client";
import { useTranslations } from "next-intl";
import { Info, Network, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import LandInfoCard from "./LandInfoCard";
import OwnershipTimeline from "./OwnershipTimeline";
import TransactionsTable from "./TransactionsTable";
import RiskCard from "@/features/risk/RiskCard";
import GenerateReportButton from "@/features/report/GenerateReportButton";
import type { RiskAssessment } from "@/features/risk/types";
import type { LandInfo, OwnershipEntry, TransactionEntry } from "./types";

export default function ResultView({ landId }: { landId?: string }) {
  const t = useTranslations();
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

  const risk = useQuery({
    queryKey: ["land", landId, "risk"],
    enabled,
    retry: false,
    queryFn: () => api.get<RiskAssessment>(`/lands/${enc}/risk`),
  });

  const back = (
    <Link href="/verify" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline">
      <Search aria-hidden="true" className="h-4 w-4" />
      {t("result.newSearch")}
    </Link>
  );

  const banner = (
    <p role="note" className="flex items-center gap-2 rounded-lg border border-review/30 bg-review-soft px-4 py-2 text-sm font-medium text-ink">
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
    body = (
      <>
        <LandInfoCard land={land.data} />
        {own.isPending ? (
          <LoadingState />
        ) : own.isError ? (
          <ErrorState message={t("result.loadError")} onRetry={() => void own.refetch()} />
        ) : (
          <OwnershipTimeline entries={own.data.entries} />
        )}
        {tx.isPending ? (
          <LoadingState />
        ) : tx.isError ? (
          <ErrorState message={t("result.loadError")} onRetry={() => void tx.refetch()} />
        ) : (
          <TransactionsTable transactions={tx.data.transactions} />
        )}
        {risk.isPending ? (
          <LoadingState />
        ) : risk.isError ? (
          <ErrorState message={t("risk.loadError")} onRetry={() => void risk.refetch()} />
        ) : (
          <RiskCard risk={risk.data} />
        )}
        <p className="text-sm text-ink-muted">{t("risk.disclaimer")}</p>
        <div>
          <Link href={`/verify/graph?land_id=${enc}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline">
            <Network aria-hidden="true" className="h-4 w-4" />
            {t("graph.viewLink")}
          </Link>
        </div>
        <GenerateReportButton landId={land.data.land_id} />
        <div>{back}</div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">{t("result.title")}</h1>
      {banner}
      {body}
    </div>
  );
}
