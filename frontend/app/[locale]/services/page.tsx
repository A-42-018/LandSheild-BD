import { setRequestLocale } from "next-intl/server";
import ServicesPage from "@/features/services/ServicesPage";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("services.title");

export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ServicesPage />;
}
