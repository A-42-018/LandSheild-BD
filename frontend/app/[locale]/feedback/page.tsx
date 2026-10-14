import { setRequestLocale } from "next-intl/server";
import FeedbackForm from "@/features/feedback/FeedbackForm";

// Public: no login. The reference number it returns is looked up on /track.
export default function FeedbackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <FeedbackForm />;
}
