import { getTranslations, setRequestLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import RequireRole from "@/features/auth/RequireRole";
import GraphView from "@/features/graph/GraphView";

export default async function GraphPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { land_id?: string | string[] };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const raw = searchParams.land_id;
  const landId = (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader title={t("graph.title")} purpose={t("graph.purpose")} crumbs={[{ label: t("nav.verify"), href: "/verify" }]} />
      <RequireRole>
        <GraphView landId={landId} />
      </RequireRole>
    </div>
  );
}
