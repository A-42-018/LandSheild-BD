"use client";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, FileCheck2, LayoutDashboard, ScrollText, ShieldCheck, Upload, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { ADMIN_ONLY, hasRole, OFFICER_UP, REVIEW_UP, type Role } from "@/features/auth/roles";

export const OFFICER_NAV: { href: string; labelKey: string; roles: Role[] }[] = [
  { href: "/officer", labelKey: "officer.nav.dashboard", roles: REVIEW_UP },
  { href: "/officer/upload", labelKey: "officer.nav.upload", roles: OFFICER_UP },
  { href: "/officer/mutations", labelKey: "officer.nav.mutations", roles: REVIEW_UP },
  { href: "/officer/audit-logs", labelKey: "officer.nav.audit", roles: OFFICER_UP },
  { href: "/officer/admin", labelKey: "officer.nav.admin", roles: ADMIN_ONLY },
];

const NAV_ICON: Record<string, LucideIcon> = {
  "/officer": LayoutDashboard,
  "/officer/upload": Upload,
  "/officer/mutations": FileCheck2,
  "/officer/audit-logs": ScrollText,
  "/officer/admin": ShieldCheck,
};

export default function OfficerShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = OFFICER_NAV.filter((i) => hasRole(user?.role, i.roles));

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
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
      <aside
        id="officer-sidebar"
        className={`${open ? "block" : "hidden"} w-full shrink-0 self-start rounded-md border border-line bg-surface py-2 lg:sticky lg:top-4 lg:block lg:w-60`}
      >
        <nav aria-label={t("officer.nav.label")}>
          <ul className="flex flex-col">
            {items.map((i) => {
              const active = i.href === "/officer" ? pathname === "/officer" : pathname.startsWith(i.href);
              const Icon = NAV_ICON[i.href] ?? ClipboardList;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-2 border-l-4 px-4 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${active ? "border-primary bg-primary-soft font-semibold text-primary" : "border-transparent font-medium text-ink hover:bg-surface-muted"}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {t(i.labelKey)}
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
