import { setRequestLocale } from "next-intl/server";
import MyProfile from "@/features/my/MyProfile";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("my.profile.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <MyProfile />;
}
