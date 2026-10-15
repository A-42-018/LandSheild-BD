import { setRequestLocale } from "next-intl/server";
import Backdrop from "@/features/landing/Backdrop";
import OfficerSignup from "@/features/officers/OfficerSignup";

/** Public: an officer picks their land office and requests an account; an admin approves it. */
export default function OfficerSignupPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:pt-2">
      <Backdrop />
      <OfficerSignup />
    </div>
  );
}
