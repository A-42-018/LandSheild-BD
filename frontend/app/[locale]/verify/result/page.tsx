import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import ResultView from "@/features/result/ResultView";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("result.title");

export default function ResultPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { land_id?: string | string[] };
}) {
  setRequestLocale(locale);
  const raw = searchParams.land_id;
  const landId = (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  return (
    <div className="mx-auto">
      <RequireRole>
        <ResultView landId={landId} />
      </RequireRole>
    </div>
  );
}
