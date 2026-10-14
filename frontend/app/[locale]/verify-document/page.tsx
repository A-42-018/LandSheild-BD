import { getTranslations, setRequestLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import WhatYouNeed from "@/features/services/WhatYouNeed";
import VerifyDocumentView from "@/features/verify-document/VerifyDocumentView";

// Public (no login): the copy is compared and discarded, never stored.
export default async function VerifyDocumentPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-3 sm:p-5">
      <PageHeader title={t("nav.verifyDoc")} purpose={t("page.verifyDocPurpose")} />
      <WhatYouNeed service="verifyDoc" />
      <VerifyDocumentView />
    </div>
  );
}
