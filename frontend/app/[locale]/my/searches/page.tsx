import { setRequestLocale } from "next-intl/server";
import { MySearches } from "@/features/my/MyLists";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("my.searches.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MySearches />;
}
