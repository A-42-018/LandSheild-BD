import { setRequestLocale } from "next-intl/server";
import { MyReports } from "@/features/my/MyLists";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyReports />;
}
