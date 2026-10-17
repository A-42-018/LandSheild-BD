import { setRequestLocale } from "next-intl/server";
import { TextPage } from "@/features/info/InfoPage";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("info.privacy.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <TextPage slug="privacy" />;
}
