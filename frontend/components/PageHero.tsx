import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "@/components/PageHeader";
import { contours } from "@/features/landing/Backdrop";

const RINGS = contours([{ cx: 700, cy: 90, rings: 6, step: 30, seed: 1.4 }]);

/** Page hero band (Template A/C/D): deep-green rounded band with contour rings, breadcrumb, H1, purpose, meta chips and an optional 3D illustration.
 *  Print renders it flat and light (see .page-hero in globals.css). */
export default function PageHero({
  title,
  purpose,
  crumbs,
  meta = [],
  art,
  actions,
}: {
  title: ReactNode;
  purpose?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode[];
  art?: ReactNode;
  actions?: ReactNode;
}) {
  const shown = meta.filter(Boolean);
  return (
    <header className="page-hero relative overflow-hidden rounded-panel text-white" data-testid="page-header">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-gold print:hidden" viewBox="0 0 800 200" preserveAspectRatio="xMaxYMid slice" fill="none">
        <path d={RINGS} stroke="currentColor" strokeOpacity="0.14" />
      </svg>
      <div className="relative flex items-center justify-between gap-6 px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex min-w-0 flex-col gap-3">
          <Breadcrumb crumbs={crumbs} tone="light" />
          <div>
            <h1 className="font-bold text-white [overflow-wrap:anywhere]">{title}</h1>
            <span aria-hidden="true" className="mt-3 block h-[3px] w-12 rounded-full bg-gradient-to-r from-gold to-gold/30 print:hidden" />
            {purpose && <p className="mt-3 max-w-2xl leading-relaxed text-white/85">{purpose}</p>}
          </div>
          {(shown.length > 0 || actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {shown.length > 0 && (
                <p data-testid="page-meta" className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  {shown.map((m, i) => (
                    <span key={i} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-white/90">
                      {m}
                    </span>
                  ))}
                </p>
              )}
              {actions}
            </div>
          )}
        </div>
        {art && (
          <div aria-hidden="true" className="hidden shrink-0 min-[400px]:block [&>svg]:h-20 [&>svg]:w-auto sm:[&>svg]:h-28 lg:[&>svg]:h-32 [@media(max-height:480px)]:!hidden print:hidden">
            {art}
          </div>
        )}
      </div>
    </header>
  );
}
