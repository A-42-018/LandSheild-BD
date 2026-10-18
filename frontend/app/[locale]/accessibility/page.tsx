import { setRequestLocale } from "next-intl/server";
import { TextPage } from "@/features/info/InfoPage";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("info.accessibility.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="info">
      <TextPage slug="accessibility" />
    </ClientMessages>
  );
}
