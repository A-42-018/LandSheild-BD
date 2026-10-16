import { setRequestLocale } from "next-intl/server";
import MyDashboard from "@/features/my/MyDashboard";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyDashboard />;
}
