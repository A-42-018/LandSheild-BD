"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui";

/** Shared frame for the citizen tools (C1–C5): page header, disclaimer, content. */
export default function ToolShell({ title, purpose, children, notice, art }: { title: string; purpose: string; children: ReactNode; notice?: string; art?: ReactNode }) {
  const t = useTranslations("tools");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title={title} purpose={purpose} art={art} crumbs={[{ label: t("title"), href: "/tools" }]} />
      <div role="note" className="glass-card flex gap-2 border-l-[3px] border-l-review p-3 text-sm text-ink">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-review" />
        <span>{notice ?? t("disclaimer")}</span>
      </div>
      <Card>{children}</Card>
    </div>
  );
}
