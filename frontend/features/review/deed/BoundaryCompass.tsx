"use client";
import { useTranslations } from "next-intl";
import { Compass } from "lucide-react";
import FieldValue from "./FieldValue";
import type { LhdrBoundaries } from "../types";

/**
 * চৌহদ্দি as a compass (H6c): North on top, South below, West left, East right, the plot in the middle.
 * With a record-edit context each side has its own Edit button (a `replace` op at the plot pointer plus boundaries and the side).
 */
export default function BoundaryCompass({
  b,
  id,
  path,
  threshold,
}: {
  b: LhdrBoundaries | null | undefined;
  id: string;
  /** JSON pointer of the plot, e.g. /schedule/0 */
  path?: string;
  threshold: number;
}) {
  const t = useTranslations("review.deed");
  const side = (k: "north" | "south" | "east" | "west", cls: string) => (
    <div className={cls}>
      <FieldValue
        id={`${id}_${k}`}
        label={t(k)}
        field={b?.[k]}
        threshold={threshold}
        path={path ? [path, "boundaries", k].join("/") : undefined}
      />
    </div>
  );
  return (
    <section
      aria-label={t("sections.boundaries")}
      data-testid={`deed-boundaries-${id}`}
      className="flex flex-col gap-1"
    >
      <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("sections.boundaries")}</h5>
      <dl className="grid gap-2 sm:grid-cols-3">
        {side("north", "sm:col-start-2 sm:row-start-1")}
        {side("west", "sm:col-start-1 sm:row-start-2")}
        <div
          aria-hidden="true"
          className="hidden items-center justify-center gap-2 rounded-lg border border-dashed border-line p-3 text-sm text-ink-muted sm:col-start-2 sm:row-start-2 sm:flex"
        >
          <Compass className="h-4 w-4" />
          {t("plotCentre")}
        </div>
        {side("east", "sm:col-start-3 sm:row-start-2")}
        {side("south", "sm:col-start-2 sm:row-start-3")}
      </dl>
    </section>
  );
}
