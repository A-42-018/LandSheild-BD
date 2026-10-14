import { getTranslations, setRequestLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import RequireRole from "@/features/auth/RequireRole";
import WhatYouNeed from "@/features/services/WhatYouNeed";
import CheckForm from "@/features/check/CheckForm";

export default async function CheckPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-3 sm:p-5">
      <PageHeader title={t("nav.check")} purpose={t("page.checkPurpose")} />
      <WhatYouNeed service="check" />
      <RequireRole>
        <CheckForm />
      </RequireRole>
    </div>
  );
}
