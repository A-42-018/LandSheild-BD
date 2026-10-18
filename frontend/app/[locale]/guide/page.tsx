import { setRequestLocale } from "next-intl/server";
import GuidePage from "@/features/guide/GuidePage";
import ClientMessages from "@/components/ClientMessages";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="guide">
      <GuidePage />
    </ClientMessages>
  );
}
