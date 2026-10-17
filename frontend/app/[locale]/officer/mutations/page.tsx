import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { REVIEW_UP } from "@/features/auth/roles";
import MutationQueue from "@/features/mutation/MutationQueue";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("mutation.title");

export default function MutationsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={REVIEW_UP}>
      <MutationQueue />
    </RequireRole>
  );
}
