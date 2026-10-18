import { setRequestLocale } from "next-intl/server";
import { FaqPage } from "@/features/info/InfoPage";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("info.faq.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="info">
      <FaqPage />
    </ClientMessages>
  );
}
