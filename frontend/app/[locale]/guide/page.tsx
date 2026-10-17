import { setRequestLocale } from "next-intl/server";
import GuidePage from "@/features/guide/GuidePage";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <GuidePage />;
}
