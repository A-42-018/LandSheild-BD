import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import GraphView from "@/features/graph/GraphView";

export default function GraphPage({
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
    <div className="mx-auto max-w-6xl">
      <RequireRole>
        <GraphView landId={landId} />
      </RequireRole>
    </div>
  );
}
