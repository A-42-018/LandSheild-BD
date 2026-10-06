import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import CheckForm from "@/features/check/CheckForm";

export default function CheckPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-xl p-3 sm:p-5">
      <RequireRole>
        <CheckForm />
      </RequireRole>
    </div>
  );
}
