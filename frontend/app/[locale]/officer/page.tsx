import { setRequestLocale } from "next-intl/server";
import DashboardView from "@/features/officer/DashboardView";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("officer.title");

export default function OfficerDashboardPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <DashboardView />;
}
