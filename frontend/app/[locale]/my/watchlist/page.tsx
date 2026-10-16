import { setRequestLocale } from "next-intl/server";
import { MyWatchlist } from "@/features/my/MyLists";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyWatchlist />;
}
