import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export interface Crumb {
  label: string;
  href: string;
}

/** Ancestor trail only (Home › … ); the current page is the H1 that follows. */
export function Breadcrumb({ crumbs = [] }: { crumbs?: Crumb[] }) {
  const t = useTranslations();
  const all = [{ label: t("nav.home"), href: "/" }, ...crumbs];
  return (
    <nav aria-label={t("page.breadcrumb")} className="text-sm print:hidden">
      <ol className="flex flex-wrap items-center gap-1 text-ink-muted">
        {all.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" className="h-4 w-4" />}
            <Link href={c.href} className="text-link underline-offset-2 hover:underline">
              {c.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** U6 (roadmap 4.5 item 3): breadcrumb, H1, one-line purpose, right-side meta ("Data as of · Ref"). */
export default function PageHeader({
  title,
  purpose,
  crumbs,
  meta = [],
}: {
  title: ReactNode;
  purpose?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode[];
}) {
  const shown = meta.filter(Boolean);
  return (
    <header className="flex flex-col gap-2 border-b border-line pb-4" data-testid="page-header">
      <Breadcrumb crumbs={crumbs} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-[1.875rem] font-bold leading-tight text-ink sm:text-[2rem]">{title}</h1>
          {purpose && <p className="mt-1 text-ink-muted">{purpose}</p>}
        </div>
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
      </div>
    </header>
  );
}
