import { setRequestLocale } from "next-intl/server";
import MyLands from "@/features/my/MyLands";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("my.lands.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyLands />;
}
