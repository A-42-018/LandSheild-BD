import { setRequestLocale } from "next-intl/server";
import PublicVerifyView from "@/features/qr/PublicVerifyView";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("publicVerify.title");

// Public (no login, no RequireRole): PublicSafe summary only.
export default function PublicVerifyPage({ params: { locale, landId } }: { params: { locale: string; landId: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-3xl">
      <PublicVerifyView landId={decodeURIComponent(landId)} />
    </div>
  );
}
