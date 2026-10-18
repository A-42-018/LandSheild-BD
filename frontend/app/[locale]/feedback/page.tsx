import { setRequestLocale } from "next-intl/server";
import FeedbackForm from "@/features/feedback/FeedbackForm";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("feedback.title");

// Public: no login. The reference number it returns is looked up on /track.
export default function FeedbackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="feedback">
      <FeedbackForm />
    </ClientMessages>
  );
}
