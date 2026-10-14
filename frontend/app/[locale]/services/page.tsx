import { setRequestLocale } from "next-intl/server";
import ServicesPage from "@/features/services/ServicesPage";

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ServicesPage />;
}
