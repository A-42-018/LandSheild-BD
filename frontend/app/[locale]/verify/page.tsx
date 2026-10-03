import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import VerifyForm from "@/features/verify/VerifyForm";

export default function VerifyPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-brand-gradient-soft p-3 sm:p-5">
      <RequireRole>
        <VerifyForm />
      </RequireRole>
    </div>
  );
}
