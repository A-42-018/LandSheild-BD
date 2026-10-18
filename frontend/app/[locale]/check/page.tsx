import { getTranslations, setRequestLocale } from "next-intl/server";
import ServiceLayout from "@/components/ServiceLayout";
import RequireRole from "@/features/auth/RequireRole";
import { ChecklistArt } from "@/features/landing/Illustrations";
import CheckForm from "@/features/check/CheckForm";
import ClientMessages from "@/components/ClientMessages";

export default async function CheckPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <ClientMessages scope="check">
      <ServiceLayout service="check" title={t("nav.check")} purpose={t("page.checkPurpose")} art={<ChecklistArt />}>
        <RequireRole>
          <CheckForm />
        </RequireRole>
      </ServiceLayout>
    </ClientMessages>
  );
}
