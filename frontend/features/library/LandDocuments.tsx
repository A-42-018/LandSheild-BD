"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import StatusBadge from "@/components/domain/StatusBadge";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import { formatDate } from "@/features/result/format";
import { documentHref, LIBRARY_TYPES } from "./types";
import { SignatureBadge } from "./VersionPanel";
import { useLandDocuments } from "./useDocumentPage";

/** The Documents section of a land (staff only): every deed of the land in deed-date order, each opening the document page. */
export default function LandDocuments({ landId }: { landId: string }) {
  const t = useTranslations("library.landDocs");
  const tl = useTranslations("library");
  const tt = useTranslations("upload.types");
  const locale = useLocale();
  const q = useLandDocuments(landId, true);
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState error={q.error} message={t("loadError")} onRetry={() => void q.refetch()} />;
  if (q.data.items.length === 0) return <p className="text-sm text-ink-muted" data-testid="land-docs-empty">{t("empty")}</p>;
  return (
    <ol className="flex flex-col gap-3" data-testid="land-documents">
      {q.data.items.map((d) => {
        const name = d.deed_no ?? t("noNumber");
        return (
          <li key={d.id} data-testid={`land-doc-${d.id}`} className="flex flex-col gap-1.5 border-l-2 border-line pl-3">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={documentHref(d)} className="font-medium text-primary underline" aria-label={tl("openRow", { name })}>
                {name}
              </Link>
              <span className="text-ink-muted">
                {(LIBRARY_TYPES as readonly string[]).includes(d.document_type) ? tt(d.document_type) : d.document_type}
                {" · "}
                {d.deed_date ? formatDate(d.deed_date, locale, "—") : t("undated")}
                {d.mouza ? ` · ${d.mouza}` : ""}
              </span>
              {d.historical && <Badge tone="review">{tl("historical")}</Badge>}
              {d.chain_link && (
                <Badge tone="verified" data-testid={`chain-link-${d.id}`}>
                  {t("chainLink")}
                </Badge>
              )}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <StatusBadge code={d.processing_status} />
              {d.approved_record ? (
                <>
                  <Badge tone="verified">{tl("digitisedYes", { version: d.approved_record.version })}</Badge>
                  <SignatureBadge status={d.approved_record.signature_status} />
                </>
              ) : (
                <span>{tl("digitisedNo")}</span>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
