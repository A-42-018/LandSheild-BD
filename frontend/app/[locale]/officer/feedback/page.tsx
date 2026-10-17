import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { OFFICER_UP } from "@/features/auth/roles";
import FeedbackAdmin from "@/features/feedback/FeedbackAdmin";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("feedback.admin.title");

export default function OfficerFeedbackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={OFFICER_UP}>
      <FeedbackAdmin />
    </RequireRole>
  );
}
