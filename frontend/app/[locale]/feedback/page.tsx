import { setRequestLocale } from "next-intl/server";
import FeedbackForm from "@/features/feedback/FeedbackForm";
import ClientMessages from "@/components/ClientMessages";

// Public: no login. The reference number it returns is looked up on /track.
export default function FeedbackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="feedback">
      <FeedbackForm />
    </ClientMessages>
  );
}
