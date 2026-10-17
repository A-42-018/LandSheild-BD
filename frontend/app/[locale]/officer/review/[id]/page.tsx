import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { REVIEW_UP } from "@/features/auth/roles";
import ReviewView from "@/features/review/ReviewView";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("review.title");

export default function ReviewPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-6xl">
      <RequireRole roles={REVIEW_UP}>
        <ReviewView id={id} />
      </RequireRole>
    </div>
  );
}
