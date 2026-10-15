import { getTranslations, setRequestLocale } from "next-intl/server";
import ServiceLayout from "@/components/ServiceLayout";
import RequireRole from "@/features/auth/RequireRole";
import { PlotSearchArt } from "@/features/landing/Illustrations";
import VerifyForm from "@/features/verify/VerifyForm";

export default async function VerifyPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <ServiceLayout service="verify" title={t("nav.verify")} purpose={t("page.verifyPurpose")} art={<PlotSearchArt />}>
      <RequireRole>
        <VerifyForm />
      </RequireRole>
    </ServiceLayout>
  );
}
