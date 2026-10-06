"use client";
import { LogIn, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/features/auth/AuthContext";
import { activeNavHref, navItemsFor } from "@/features/auth/roles";

const ICON_BTN =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/**
 * Right-most header control (UD10 sketch): a user icon.
 * Anonymous → link to sign in. Signed in → opens a panel with name + role, the pages that are
 * not in the header bar (role-filtered) and Sign out.
 */
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
      <Link href="/login" aria-label={t("nav.login")} title={t("nav.login")} className={ICON_BTN}>
        <LogIn aria-hidden="true" className="h-5 w-5" />
      </Link>
    );
  }
  if (status !== "authenticated" || !user) return null;

  const all = navItemsFor(user.role);
  const active = activeNavHref(pathname ?? "/", all);
  const more = all.filter((i) => !i.primary);

  return (
    <div ref={root} className="md:relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t("nav.account")}
        title={t("nav.signedInAs", { name: user.name })}
        onClick={() => setOpen((o) => !o)}
        className={ICON_BTN}
      >
        <User aria-hidden="true" className="h-5 w-5" />
      </button>
      <div
        id="account-menu"
        hidden={!open}
        className="absolute inset-x-4 top-full z-50 mt-2 md:inset-x-auto md:right-0 md:w-64 rounded-lg border border-line bg-surface p-2 text-ink shadow-raised"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-2 pb-2 pt-1">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <Badge tone="pending">{t(`roles.${user.role}`)}</Badge>
        </div>
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
        <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-2">
          <span className="text-sm text-ink-muted">{t("theme.label")}</span>
          <ThemeToggle />
        </div>
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
