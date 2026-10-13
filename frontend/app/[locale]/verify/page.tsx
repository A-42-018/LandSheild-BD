import { getTranslations, setRequestLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import RequireRole from "@/features/auth/RequireRole";
import VerifyForm from "@/features/verify/VerifyForm";

export default async function VerifyPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t("nav.verify")} purpose={t("page.verifyPurpose")} />
      <RequireRole>
        <VerifyForm />
      </RequireRole>
    </div>
  );
}
