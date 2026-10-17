import { getTranslations, setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { OFFICER_UP } from "@/features/auth/roles";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import PageTip from "@/components/PageTip";
import UploadForm from "@/features/upload/UploadForm";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("upload.title");

export default async function UploadPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <RequireRole roles={OFFICER_UP}>
        <OfficerPageHeader title={t("upload.title")} purpose={t("upload.purpose")} />
        <PageTip page="upload" />
        <UploadForm />
      </RequireRole>
    </div>
  );
}
