import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { OFFICER_UP } from "@/features/auth/roles";
import UploadForm from "@/features/upload/UploadForm";

export default function UploadPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-xl">
      <RequireRole roles={OFFICER_UP}>
        <UploadForm />
      </RequireRole>
    </div>
  );
}
