import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import ReportView from "@/features/report/ReportView";
import ClientMessages from "@/components/ClientMessages";

export default function ReportPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="record">
      <div className="mx-auto max-w-3xl print:max-w-none">
        <RequireRole>
          <ReportView id={id} />
        </RequireRole>
      </div>
    </ClientMessages>
  );
}
