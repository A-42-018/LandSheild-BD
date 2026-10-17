import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { OFFICER_UP } from "@/features/auth/roles";
import HearingCalendar from "@/features/hearings/HearingCalendar";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("hearings.title");

export default function HearingsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <RequireRole roles={OFFICER_UP}>
      <HearingCalendar />
    </RequireRole>
  );
}
