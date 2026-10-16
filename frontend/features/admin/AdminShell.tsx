"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Building2, Database, FileText, LayoutDashboard, ScrollText, Settings, UserCheck, Users, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";

export const ADMIN_NAV: { href: string; key: string; Icon: LucideIcon }[] = [
  { href: "/admin", key: "overview", Icon: LayoutDashboard },
  { href: "/admin/users", key: "users", Icon: Users },
  { href: "/admin/officer-requests", key: "officerRequests", Icon: UserCheck },
  { href: "/admin/offices", key: "offices", Icon: Building2 },
  { href: "/admin/content", key: "content", Icon: FileText },
  { href: "/admin/records", key: "records", Icon: Database },
  { href: "/admin/audit-logs", key: "audit", Icon: ScrollText },
  { href: "/admin/settings", key: "settings", Icon: Settings },
];

/** The administrator's own area (U3.5): a side menu on desktop, a sideways-scrolling tab row on phones (same pattern as /my). */
export default function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const { user } = useAuth();
  const row = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = row.current;
    const el = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (ul && el && ul.scrollWidth > ul.clientWidth) ul.scrollLeft = el.offsetLeft - (ul.clientWidth - el.offsetWidth) / 2;
  }, [pathname]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="glass-card shrink-0 self-start overflow-hidden p-0 max-lg:w-full lg:sticky lg:top-20 lg:w-64">
        {user && (
          <div className="auth-panel hidden items-center gap-3 p-4 text-white lg:flex">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/60 bg-white/10 text-sm font-semibold text-gold-soft">
              {user.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/75">{t("label")}</p>
            </div>
          </div>
        )}
        <nav aria-label={t("label")} className="p-2">
          <ul ref={row} className="relative flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {ADMIN_NAV.map(({ href, key, Icon }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-touch items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:border-l-4 lg:px-2 ${
                      active ? "bg-primary-soft font-semibold text-primary lg:border-gold" : "font-medium text-ink hover:bg-primary-soft/60 lg:border-transparent"
                    }`}
                  >
                    <span aria-hidden="true" className="icon-tile !h-8 !w-8 !rounded-lg"><Icon className="h-4 w-4" /></span>
                    <span>{t(key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
