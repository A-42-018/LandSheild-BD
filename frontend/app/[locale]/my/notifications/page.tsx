import { setRequestLocale } from "next-intl/server";
import { MyNotifications } from "@/features/my/MyLists";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("my.notes.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyNotifications />;
}
