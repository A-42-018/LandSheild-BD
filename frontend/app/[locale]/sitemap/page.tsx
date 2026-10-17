import { setRequestLocale } from "next-intl/server";
import { SitemapPage } from "@/features/info/InfoPage";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("info.sitemap.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <SitemapPage />;
}
