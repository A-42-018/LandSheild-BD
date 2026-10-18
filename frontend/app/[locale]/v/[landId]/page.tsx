import { setRequestLocale } from "next-intl/server";
import PublicVerifyView from "@/features/qr/PublicVerifyView";
import ClientMessages from "@/components/ClientMessages";

// Public (no login, no RequireRole): PublicSafe summary only.
export default function PublicVerifyPage({ params: { locale, landId } }: { params: { locale: string; landId: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="publicRecord">
      <div className="mx-auto max-w-3xl">
        <PublicVerifyView landId={decodeURIComponent(landId)} />
      </div>
    </ClientMessages>
  );
}
