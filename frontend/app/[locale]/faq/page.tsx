import { setRequestLocale } from "next-intl/server";
import { FaqPage } from "@/features/info/InfoPage";
import ClientMessages from "@/components/ClientMessages";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="info">
      <FaqPage />
    </ClientMessages>
  );
}
