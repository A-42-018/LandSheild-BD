import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { REVIEW_UP } from "@/features/auth/roles";
import ReviewerHome from "@/features/reviewer/ReviewerHome";

export default function ReviewerHomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-6xl">
      <RequireRole roles={REVIEW_UP}>
        <ReviewerHome />
      </RequireRole>
    </div>
  );
}
