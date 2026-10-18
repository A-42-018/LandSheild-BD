import { setRequestLocale } from "next-intl/server";
import { SitemapPage } from "@/features/info/InfoPage";
import ClientMessages from "@/components/ClientMessages";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="info">
      <SitemapPage />
    </ClientMessages>
  );
}
