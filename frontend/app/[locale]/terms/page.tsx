import { setRequestLocale } from "next-intl/server";
import { TextPage } from "@/features/info/InfoPage";
import ClientMessages from "@/components/ClientMessages";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="info">
      <TextPage slug="terms" />
    </ClientMessages>
  );
}
