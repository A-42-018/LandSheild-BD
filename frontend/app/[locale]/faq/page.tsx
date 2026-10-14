import { setRequestLocale } from "next-intl/server";
import { FaqPage } from "@/features/info/InfoPage";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <FaqPage />;
}
