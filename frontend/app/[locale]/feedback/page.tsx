import { setRequestLocale } from "next-intl/server";
import FeedbackForm from "@/features/feedback/FeedbackForm";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("feedback.title");

// Public: no login. The reference number it returns is looked up on /track.
export default function FeedbackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <FeedbackForm />;
}
