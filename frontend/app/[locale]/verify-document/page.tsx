import { getTranslations, setRequestLocale } from "next-intl/server";
import ServiceLayout from "@/components/ServiceLayout";
import { DeedArt } from "@/features/landing/Illustrations";
import VerifyDocumentView from "@/features/verify-document/VerifyDocumentView";

// Public (no login): the copy is compared and discarded, never stored.
export default async function VerifyDocumentPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <ServiceLayout service="verifyDoc" title={t("nav.verifyDoc")} purpose={t("page.verifyDocPurpose")} art={<DeedArt />}>
      <VerifyDocumentView />
    </ServiceLayout>
  );
}
