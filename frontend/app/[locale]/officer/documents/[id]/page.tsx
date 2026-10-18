import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { REVIEW_UP } from "@/features/auth/roles";
import DocumentPage from "@/features/library/DocumentPage";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("library.doc.title");

export default function OfficerDocumentPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-7xl">
      <RequireRole roles={REVIEW_UP}>
        <DocumentPage id={id} />
      </RequireRole>
    </div>
  );
}
