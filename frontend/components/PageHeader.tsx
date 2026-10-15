import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import PageHero from "@/components/PageHero";

export interface Crumb {
  label: string;
  href: string;
}

/** Ancestor trail only (Home › … ); the current page is the H1 that follows. */
export function Breadcrumb({ crumbs = [], tone = "default" }: { crumbs?: Crumb[]; tone?: "default" | "light" }) {
  const light = tone === "light";
  const t = useTranslations();
  const all = [{ label: t("nav.home"), href: "/" }, ...crumbs];
  return (
    <nav aria-label={t("page.breadcrumb")} className="text-sm print:hidden">
      <ol className={`flex flex-wrap items-center gap-1 ${light ? "text-white/75" : "text-ink-muted"}`}>
        {all.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" className={`h-4 w-4 ${light ? "text-gold" : ""}`} />}
            <Link href={c.href} className={`underline-offset-2 hover:underline ${light ? "text-white/90 hover:text-white/100" : "text-link"}`}>
              {c.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Page header. Default = deep-green hero band (UI v2, R2); variant="plain" = light header with a bottom rule (officer workspace). */
export default function PageHeader({
  title,
  purpose,
  crumbs,
  meta = [],
  art,
  actions,
  variant = "hero",
}: {
  title: ReactNode;
  purpose?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode[];
  /** Small 3D illustration (hero variant only), e.g. <PlotSearchArt />. */
  art?: ReactNode;
  actions?: ReactNode;
  variant?: "hero" | "plain";
}) {
  if (variant === "hero") return <PageHero title={title} purpose={purpose} crumbs={crumbs} meta={meta} art={art} actions={actions} />;
  const shown = meta.filter(Boolean);
  return (
    <header className="flex flex-col gap-2 border-b border-line pb-4" data-testid="page-header">
      <Breadcrumb crumbs={crumbs} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="font-bold leading-tight text-ink">{title}</h1>
          <span aria-hidden="true" className="mt-3 block h-[3px] w-12 rounded-full bg-gradient-to-r from-primary to-gold print:hidden" />
          {purpose && <p className="mt-2 text-ink-muted">{purpose}</p>}
        </div>
        {(shown.length > 0 || actions) && (
          <div className="flex flex-wrap items-center gap-2">
            {shown.length > 0 && (
              <p data-testid="page-meta" className="shrink-0 text-sm text-ink-muted sm:text-right">
                {shown.map((m, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {m}
                  </span>
                ))}
              </p>
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
