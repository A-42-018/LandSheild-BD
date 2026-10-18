"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Archive, CalendarDays, ClipboardList, FileCheck2, FolderOpen, LayoutDashboard, ListChecks, MessageSquare, ScrollText, ShieldCheck, Upload, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Badge, Button } from "@/components/ui";
import IdleTimeout from "@/features/auth/IdleTimeout";
import { useAuth } from "@/features/auth/AuthContext";
import { ADMIN_ONLY, hasRole, OFFICER_UP, REVIEW_UP, type Role } from "@/features/auth/roles";

export const OFFICER_NAV: { href: string; labelKey: string; roles: Role[] }[] = [
  { href: "/officer/review", labelKey: "officer.nav.today", roles: ["REVIEWER"] },
  { href: "/officer", labelKey: "officer.nav.dashboard", roles: REVIEW_UP },
  { href: "/officer/upload", labelKey: "officer.nav.upload", roles: OFFICER_UP },
  { href: "/officer/documents", labelKey: "officer.nav.documents", roles: REVIEW_UP },
  { href: "/officer/mutations", labelKey: "officer.nav.mutations", roles: REVIEW_UP },
  { href: "/officer/hearings", labelKey: "officer.nav.hearings", roles: OFFICER_UP },
  { href: "/officer/archive", labelKey: "officer.nav.archive", roles: REVIEW_UP },
  { href: "/officer/feedback", labelKey: "officer.nav.feedback", roles: OFFICER_UP },
  { href: "/officer/audit-logs", labelKey: "officer.nav.audit", roles: OFFICER_UP },
  { href: "/admin", labelKey: "officer.nav.admin", roles: ADMIN_ONLY },
];

const NAV_ICON: Record<string, LucideIcon> = {
  "/officer/review": ListChecks,
  "/officer": LayoutDashboard,
  "/officer/upload": Upload,
  "/officer/documents": FolderOpen,
  "/officer/mutations": FileCheck2,
  "/officer/hearings": CalendarDays,
  "/officer/archive": Archive,
  "/officer/feedback": MessageSquare,
  "/officer/audit-logs": ScrollText,
  "/admin": ShieldCheck,
};

// client-messages: officer.nav (labelKey values in OFFICER_NAV)
export default function OfficerShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = OFFICER_NAV.filter((i) => hasRole(user?.role, i.roles));
  const office = user?.office ? (locale === "bn" ? user.office.name_bn : user.office.name_en) : null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls="officer-sidebar"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? t("officer.nav.close") : t("officer.nav.open")}
        </Button>
      </div>
      {open && <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-brand-deep/60 backdrop-blur-sm lg:hidden" />}
      <aside
        id="officer-sidebar"
        className={`${open ? "fixed inset-y-0 left-0 z-40 block w-72 overflow-y-auto rounded-none" : "hidden"} glass-card !rounded-card shrink-0 self-start overflow-hidden p-0 lg:sticky lg:top-20 lg:block lg:w-16 xl:w-60 ${open ? "" : "w-full"}`}
      >
        {user && (
          <div className="auth-panel flex items-center gap-3 p-4 text-white lg:max-xl:justify-center lg:max-xl:p-3">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/60 bg-white/10 text-sm font-semibold text-gold-soft">
              {user.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0 lg:max-xl:sr-only">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              {office && <p className="truncate text-xs text-white/75">{office}</p>}
              <Badge tone="pending" className="mt-1">{t(`roles.${user.role}`)}</Badge>
            </div>
          </div>
        )}
        <nav aria-label={t("officer.nav.label")} className="p-2">
          <ul className="flex flex-col gap-1">
            {items.map((i) => {
              const active = i.href === "/officer" ? pathname === "/officer" : pathname.startsWith(i.href);
              const Icon = NAV_ICON[i.href] ?? ClipboardList;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    title={t(i.labelKey)}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-xl border-l-4 px-2 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:max-xl:justify-center ${active ? "border-gold bg-primary-soft font-semibold text-primary" : "border-transparent font-medium text-ink hover:bg-primary-soft/60"}`}
                  >
                    <span aria-hidden="true" className="icon-tile !h-8 !w-8 !rounded-lg"><Icon className="h-4 w-4" /></span>
                    <span className="lg:max-xl:sr-only">{t(i.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <IdleTimeout />
    </div>
  );
}
