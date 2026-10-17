import { setRequestLocale } from "next-intl/server";
import GuidePage from "@/features/guide/GuidePage";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("guide.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <GuidePage />;
}
