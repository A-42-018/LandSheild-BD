import { getTranslations, setRequestLocale } from "next-intl/server";
import ServiceLayout from "@/components/ServiceLayout";
import { PlotSearchArt } from "@/features/landing/Illustrations";
import VerifyForm from "@/features/verify/VerifyForm";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("nav.verify");

export default async function VerifyPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <ClientMessages scope="verify">
      <ServiceLayout service="verify" title={t("nav.verify")} purpose={t("page.verifyPurpose")} art={<PlotSearchArt />} tip="verify">
        {/* U2.2: public. Visitors get a masked summary; the full result page still needs sign-in. */}
        <VerifyForm />
      </ServiceLayout>
    </ClientMessages>
  );
}
