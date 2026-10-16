import { setRequestLocale } from "next-intl/server";
import MyProfile from "@/features/my/MyProfile";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyProfile />;
}
