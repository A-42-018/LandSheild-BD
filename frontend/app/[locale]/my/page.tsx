import { setRequestLocale } from "next-intl/server";
import MyDashboard from "@/features/my/MyDashboard";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("my.nav.dashboard");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyDashboard />;
}
