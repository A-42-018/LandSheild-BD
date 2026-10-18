import { setRequestLocale } from "next-intl/server";
import OfficerSignup from "@/features/officers/OfficerSignup";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("officerSignup.title");

/** Public: an officer picks their land office and requests an account; an admin approves it. */
export default function OfficerSignupPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="officerSignup">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:pt-2">
        <OfficerSignup />
      </div>
    </ClientMessages>
  );
}
