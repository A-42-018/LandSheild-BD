import { setRequestLocale } from "next-intl/server";
import FeeCalculator from "@/features/tools/FeeCalculator";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("tools.fees.title");

// Public tool: no sign-in, no personal data, nothing is sent to the server.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <FeeCalculator />;
}
