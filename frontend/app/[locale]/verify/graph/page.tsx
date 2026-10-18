import { getTranslations, setRequestLocale } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import RequireRole from "@/features/auth/RequireRole";
import GraphView from "@/features/graph/GraphView";
import { ShieldArt } from "@/features/landing/Illustrations";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("graph.title");

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
  const crumbs = [{ label: t("nav.verify"), href: "/verify" }];
  if (landId) crumbs.push({ label: t("result.title"), href: `/verify/result?land_id=${encodeURIComponent(landId)}` });
  return (
    <ClientMessages scope="record">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        {/* the only header on this page: GraphView has none (two used to give two H1s and two breadcrumb navs) */}
        <PageHeader title={t("graph.title")} purpose={t("graph.purpose")} crumbs={crumbs} art={<ShieldArt />} />
        <RequireRole>
          <GraphView landId={landId} />
        </RequireRole>
      </div>
    </ClientMessages>
  );
}
