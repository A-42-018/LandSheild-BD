"use client";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/domain/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui";
import DocumentPreview from "./DocumentPreview";
import ExtractionPanel from "./ExtractionPanel";
import { EXTRACTION_READY, IN_PROGRESS } from "./types";
import { useDocumentStatus, useExtraction } from "./useReviewData";

export default function ReviewView({ id }: { id: string }) {
  const t = useTranslations("review");
  const te = useTranslations("errors");
  const doc = useDocumentStatus(id);
  const status = doc.data?.processing_status;
  const ext = useExtraction(id, status);

  if (doc.isLoading) return <LoadingState />;
  if (doc.isError || !doc.data) {
    const e = doc.error;
    if (e instanceof ApiError && e.status === 404) return <ErrorState message={t("notFound")} />;
    if (e instanceof ApiError && e.status === 403) return <ErrorState message={te("permission")} />;
    return <ErrorState onRetry={() => doc.refetch()} />;
  }

  const d = doc.data;
  let body;
  if (status && IN_PROGRESS.includes(status)) {
    body = (
      <div role="status" data-testid="processing-state" className="rounded-xl border border-line bg-surface p-6 text-center text-ink-muted shadow-card">
        {t("processing")}
      </div>
    );
  } else if (status === "FAILED") {
    const code = d?.failure_code;
    body = <ErrorState message={code && t.has(`failed.${code}`) ? t(`failed.${code}`) : te("generic")} />;
  } else if (status && EXTRACTION_READY.includes(status)) {
    if (ext.isLoading) body = <LoadingState />;
    else if (ext.isError || !ext.data) {
      const notReady = ext.error instanceof ApiError && ext.error.code === "EXTRACTION_NOT_READY";
      body = <ErrorState message={notReady ? t("processing") : undefined} onRetry={() => ext.refetch()} />;
    } else body = <ExtractionPanel data={ext.data} />;
  } else body = <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        purpose={t("purpose")}
        crumbs={[{ label: te("officerCrumb"), href: "/officer" }]}
        meta={[
          <span key="s" data-testid="review-status">
            <StatusBadge code={d.processing_status} />
          </span>,
          `${t("docType")}: ${d.document_type}${d.land_id ? ` · ${d.land_id}` : ""}`,
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0" data-testid="review-columns">
        <div className="min-w-0 lg:border-r lg:border-line lg:pr-6">
          <DocumentPreview id={id} fileType={d.file_type} />
        </div>
        <div className="min-w-0 lg:pl-6">{body}</div>
      </div>
    </div>
  );
}
