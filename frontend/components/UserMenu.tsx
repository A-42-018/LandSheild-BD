"use client";
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui";
import HeaderDropdown from "./HeaderDropdown";
import { useAuth } from "@/features/auth/AuthContext";
import { activeNavHref, navItemsFor, redirectFor } from "@/features/auth/roles";
import NotificationBell from "./NotificationBell";

const ICON_BTN =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gold/60 bg-black/20 text-gold-soft transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * Right-most header control (UD10 sketch): a user icon.
 * Anonymous → "Sign in ▾" asking who they are (citizen / officer). Signed in → opens a panel with name + role, the pages that are
 * not in the header bar (role-filtered) and Sign out.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function UserMenu() {
  const t = useTranslations();
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (status === "anonymous") {
    return (
      <HeaderDropdown
        id="login-menu"
        variant="action"
        label={t("nav.login")}
        icon={<LogIn aria-hidden="true" className="h-4 w-4" />}
        items={[
          { href: "/login", label: t("nav.citizenLogin") },
          { href: "/officer-login", label: t("nav.officerLogin") },
        ]}
      />
    );
  }
  if (status !== "authenticated" || !user) return null;

  const all = navItemsFor(user.role);
  const active = activeNavHref(pathname ?? "/", all);
  const home = redirectFor(user.role);
  const more = all.filter((i) => !i.primary && i.href !== home);

  return (
    <div ref={root} className="flex items-center gap-2 min-[1280px]:relative">
      <Badge tone="pending" className="hidden sm:inline-flex" data-testid="role-badge">{t(`roles.${user.role}`)}</Badge>
      {user.role === "CITIZEN" && <NotificationBell className={ICON_BTN} />}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t("nav.account")}
        title={t("nav.signedInAs", { name: user.name })}
        onClick={() => setOpen((o) => !o)}
        className={ICON_BTN}
      >
        <span aria-hidden="true" className="text-sm font-semibold leading-none">{initials(user.name)}</span>
      </button>
      <div
        id="account-menu"
        hidden={!open}
        className="absolute inset-x-4 top-full z-50 mt-2 min-[1280px]:inset-x-auto min-[1280px]:right-0 min-[1280px]:w-72 rounded-xl border border-line bg-surface p-2 text-ink shadow-raised"
      >
        <div className="flex items-center gap-3 border-b border-line px-2 pb-3 pt-2">
          <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
            <Badge tone="pending" className="mt-1">{t(`roles.${user.role}`)}</Badge>
          </div>
        </div>
        <ul className="my-1 space-y-0.5">
          <li>
            <Link
              href={home}
              aria-current={home === active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                home === active ? "bg-primary-soft text-primary" : "text-ink"
              }`}
            >
              <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
              {t("nav.myDashboard")}
            </Link>
          </li>
        </ul>
        {more.length > 0 && (
          <ul className="my-1 space-y-0.5">
            {more.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={i.href === active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-md px-2 py-1.5 text-sm hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    i.href === active ? "bg-primary-soft font-semibold text-primary" : "text-ink"
                  }`}
                >
                  {t(i.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line" />
        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-critical hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
