import { setRequestLocale } from "next-intl/server";
import { MyWatchlist } from "@/features/my/MyLists";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("my.watch.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyWatchlist />;
}
