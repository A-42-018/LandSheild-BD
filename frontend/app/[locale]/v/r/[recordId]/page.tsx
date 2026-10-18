import { setRequestLocale } from "next-intl/server";
import PublicRecordView from "@/features/qr/PublicRecordView";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("publicRecord.title");

// Public (no login, no RequireRole): valid / invalid + deed no, version and approval date only.
export default function PublicRecordPage({ params: { locale, recordId } }: { params: { locale: string; recordId: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-3xl">
      <PublicRecordView recordId={decodeURIComponent(recordId)} />
    </div>
  );
}
