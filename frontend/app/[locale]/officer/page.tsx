import { setRequestLocale } from "next-intl/server";
import DashboardView from "@/features/officer/DashboardView";

export default function OfficerDashboardPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <DashboardView />;
}
