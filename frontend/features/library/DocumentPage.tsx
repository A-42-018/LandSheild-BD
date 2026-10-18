"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, FileSearch, ListChecks } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import StatusBadge from "@/components/domain/StatusBadge";
import { Badge, Card, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import { HighlightProvider } from "@/features/review/highlight";
import DocumentPreview from "@/features/review/DocumentPreview";
import DeedView from "@/features/review/deed/DeedView";
import { BAND_TONE, bandFor, percent } from "@/features/review/confidence";
import { useDocumentStatus } from "@/features/review/useReviewData";
import type { LhdrRecord } from "@/features/review/types";
import { reviewHref, UNDER_REVIEW, type RecordVersion } from "./types";
import DownloadMenu from "./DownloadMenu";
import VersionHistory from "./VersionHistory";
import VersionPanel, { defaultVersion } from "./VersionPanel";
import { useRecordVersion, useRecordVersions } from "./useDocumentPage";

interface FlatField {
  field: string;
  value: string | null;
  confidence?: number;
}

/** A `core/1` record: the 13 flat fields of a modern deed (or a khatian / porcha). */
function flatFields(rec: Record<string, unknown> | null | undefined): FlatField[] {
  const f = rec?.fields;
  return Array.isArray(f) ? (f as FlatField[]) : [];
}

function FlatView({ version }: { version: RecordVersion }) {
  const t = useTranslations("review");
  const rows = flatFields(version.record);
  return (
    <Card title={t("fieldsTitle")} icon={<ListChecks />} data-testid="flat-view">
      <dl className="divide-y divide-line">
        {rows.map((f) => {
          const band = typeof f.confidence === "number" ? bandFor(f.confidence, 0.85) : null;
          return (
            <div key={f.field} data-testid={`flat-${f.field}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {t.has(`fields.${f.field}`) ? t(`fields.${f.field}`) : f.field}
              </dt>
              <dd className="flex items-center gap-2">
                <span className={f.value ? "break-words text-ink" : "text-ink-muted"}>{f.value ? f.value : t("valueNotFound")}</span>
                {band && (
                  <Badge tone={BAND_TONE[band]}>
                    {t(`band.${band}`)} · {percent(f.confidence as number)}%
                  </Badge>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

/**
 * H7d: the document page. Left: the original upload. Right: the digital deed of the chosen version (read-only),
 * a version picker, who changed what, the SHA-256 of the file and the record, and the signature state.
 */
export default function DocumentPage({ id }: { id: string }) {
  const t = useTranslations("library.doc");
  const doc = useDocumentStatus(id);
  const versions = useRecordVersions(id);
  const items = versions.data?.items ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  const first = defaultVersion(items);
  // a new version (after a correction) may appear while the page is open; keep the reader's pick when it still exists
  useEffect(() => {
    if (picked !== null && !items.some((i) => i.version === picked)) setPicked(null);
  }, [items, picked]);
  const selected = picked ?? first;
  const version = useRecordVersion(id, selected);

  if (doc.isLoading) return <LoadingState />;
  if (doc.isError || !doc.data) {
    const e = doc.error;
    if (e instanceof ApiError && e.status === 404) return <ErrorState message={t("notFound")} />;
    return <ErrorState error={e} onRetry={() => doc.refetch()} />;
  }
  const d = doc.data;
  const underReview = UNDER_REVIEW.includes(d.processing_status);
  const rec = version.data;
  const lhdr = rec?.record_schema === "lhdr/1" && rec.record ? (rec.record as unknown as LhdrRecord) : null;

  let digital: React.ReactNode;
  if (versions.isLoading || (selected !== null && version.isLoading)) digital = <LoadingState />;
  else if (versions.isError) digital = <ErrorState error={versions.error} onRetry={() => versions.refetch()} />;
  else if (selected === null) {
    digital = (
      <EmptyState
        title={t("noVersions")}
        description={underReview ? t("noVersionsReview") : undefined}
        action={underReview ? <Link href={reviewHref(id)} className="text-sm font-medium text-link underline">{t("reviewLink")}</Link> : undefined}
      />
    );
  } else if (version.isError || !rec) digital = <ErrorState error={version.error} onRetry={() => version.refetch()} />;
  else digital = lhdr ? <DeedView record={lhdr} readOnly /> : <FlatView version={rec} />;

  return (
    <div className="flex flex-col gap-4" data-testid="document-page">
      <OfficerPageHeader
        title={t("title")}
        purpose={t("purpose")}
        crumbs={[{ label: t("crumbLibrary"), href: "/officer/documents" }]}
        meta={[
          <span key="s" data-testid="document-status"><StatusBadge code={d.processing_status} /></span>,
          `${d.document_type}${d.land_id ? ` · ${d.land_id}` : ""}`,
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/officer/documents" className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t("back")}
        </Link>
        <span className="sm:ml-auto">
          <DownloadMenu
            documentId={id}
            fileType={d.file_type}
            version={selected}
            draft={!(rec ? rec.status === "APPROVED" || rec.status === "SUPERSEDED" : false)}
            hasRecord={selected !== null}
          />
        </span>
        {underReview && (
          <Link href={reviewHref(id)} data-testid="review-link" className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline">
            <FileSearch aria-hidden="true" className="h-4 w-4" />
            {t("reviewLink")}
          </Link>
        )}
      </div>
      {underReview && (
        <p role="note" data-testid="under-review-note" className="glass-card border-l-[3px] border-l-review px-4 py-2 text-sm text-ink">
          {t("underReview")}
        </p>
      )}
      <HighlightProvider>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2" data-testid="document-columns">
          <div className="min-w-0 flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">{t("original")}</h2>
            <DocumentPreview id={id} fileType={d.file_type} />
          </div>
          <div className="min-w-0 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-ink">{t("digital")}</h2>
            {versions.data && selected !== null && (
              <VersionPanel items={items} fileHash={versions.data.file_hash || d.file_hash} selected={selected} onSelect={setPicked} version={rec} />
            )}
            {digital}
            {selected !== null && <VersionHistory id={id} version={selected} />}
          </div>
        </div>
      </HighlightProvider>
    </div>
  );
}
