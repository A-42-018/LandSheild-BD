import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import ReportView from "@/features/report/ReportView";

export default function ReportPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      <RequireRole>
        <ReportView id={id} />
      </RequireRole>
    </div>
  );
}
