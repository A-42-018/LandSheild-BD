import { setRequestLocale } from "next-intl/server";
import GuidePage from "@/features/guide/GuidePage";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("guide.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="guide">
      <GuidePage />
    </ClientMessages>
  );
}
