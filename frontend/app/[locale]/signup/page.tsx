import { setRequestLocale } from "next-intl/server";
import CitizenSignup from "@/features/auth/CitizenSignup";

/** Public: a citizen creates an account (role is always CITIZEN on the server). */
export default function SignupPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:pt-2">
      <CitizenSignup />
    </div>
  );
}
