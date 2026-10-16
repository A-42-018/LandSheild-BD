import { setRequestLocale } from "next-intl/server";
import { MyNotifications } from "@/features/my/MyLists";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyNotifications />;
}
