"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";
import { ShieldArt } from "@/features/landing/Illustrations";
import { ApiError } from "@/lib/api";
import GraphCanvas from "./GraphCanvas";
import GraphDetail from "./GraphDetail";
import GraphLegend from "./GraphLegend";
import GraphList from "./GraphList";
import { useGraph } from "./useGraph";

export default function GraphView({ landId }: { landId?: string }) {
  const t = useTranslations();
  const q = useGraph(landId);
  const [mode, setMode] = useState<"graph" | "list">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const enc = landId ? encodeURIComponent(landId) : "";

  const back = (
    <Link
      href={landId ? `/verify/result?land_id=${enc}` : "/verify"}
      className="text-sm font-medium text-primary underline"
    >
      {landId ? t("graph.backToResult") : t("result.newSearch")}
    </Link>
  );

  let body: React.ReactNode;
  if (!landId) {
    body = <EmptyState title={t("common.empty")} action={back} />;
  } else if (q.isPending) {
    body = <LoadingState />;
  } else if (q.isError) {
    const e = q.error;
    body =
      e instanceof ApiError && (e.status === 404 || e.code === "LAND_NOT_FOUND") ? (
        <EmptyState title={t("common.empty")} action={back} />
      ) : (
        <ErrorState
          message={e instanceof ApiError && e.status === 403 ? t("errors.permission") : t("graph.loadError")}
          onRetry={() => void q.refetch()}
        />
      );
  } else if (q.data.edges.length === 0 && q.data.nodes.length <= 1) {
    body = <EmptyState title={t("graph.emptyGraph")} action={back} />;
  } else {
    const g = q.data;
    body = (
      <>
        <GraphLegend />
        <div role="group" aria-label={t("graph.viewSwitch")} className="glass-card flex w-fit gap-2 p-1.5">
          <Button size="sm" variant={mode === "graph" ? "primary" : "secondary"} aria-pressed={mode === "graph"} onClick={() => setMode("graph")}>
            {t("graph.viewGraph")}
          </Button>
          <Button size="sm" variant={mode === "list" ? "primary" : "secondary"} aria-pressed={mode === "list"} onClick={() => setMode("list")}>
            {t("graph.viewList")}
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
          <div className="flex min-w-0 flex-col gap-2">
            {mode === "graph" ? (
              <>
                <GraphCanvas graph={g} selectedId={selected} onSelect={setSelected} />
                <p className="text-xs text-ink-muted">{t("graph.panHint")}</p>
              </>
            ) : (
              <GraphList graph={g} selectedId={selected} onSelect={setSelected} />
            )}
          </div>
          <GraphDetail graph={g} selectedId={selected} />
        </div>
        <p className="text-sm text-ink-muted">{t("graph.flaggedNote")}</p>
        <div>{back}</div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("graph.title")}
        art={<ShieldArt />}
        crumbs={landId ? [{ label: t("nav.verify"), href: "/verify" }, { label: t("result.title"), href: `/verify/result?land_id=${enc}` }] : [{ label: t("nav.verify"), href: "/verify" }]}
      />
      <p role="note" className="glass-card px-4 py-2 text-sm font-medium text-ink">
        {t("common.demoLabel")}
      </p>
      {body}
    </div>
  );
}
