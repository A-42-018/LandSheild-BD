import { setRequestLocale } from "next-intl/server";
import { TextPage } from "@/features/info/InfoPage";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <TextPage slug="terms" />;
}
