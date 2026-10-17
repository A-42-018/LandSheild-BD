import { getTranslations, setRequestLocale } from "next-intl/server";
import ServiceLayout from "@/components/ServiceLayout";
import { PlotSearchArt } from "@/features/landing/Illustrations";
import VerifyForm from "@/features/verify/VerifyForm";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("nav.verify");

export default async function VerifyPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <ServiceLayout service="verify" title={t("nav.verify")} purpose={t("page.verifyPurpose")} art={<PlotSearchArt />}>
      {/* U2.2: public. Visitors get a masked summary; the full result page still needs sign-in. */}
      <VerifyForm />
    </ServiceLayout>
  );
}
