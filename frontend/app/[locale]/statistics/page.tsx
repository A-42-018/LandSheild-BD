import { setRequestLocale } from "next-intl/server";
import StatisticsPage from "@/features/statistics/StatisticsPage";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("statistics.title");

// Public, statically generated: the figures are sample data in features/statistics/sample.ts, no API call.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <StatisticsPage />;
}
