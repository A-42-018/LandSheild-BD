"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, FileSearch, Lock, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type AuthMode = "login" | "signup" | "officer";

const TABS: { mode: AuthMode; href: string; key: string }[] = [
  { mode: "login", href: "/login", key: "tabLogin" },
  { mode: "signup", href: "/signup", key: "tabSignup" },
  { mode: "officer", href: "/officer-signup", key: "tabOfficer" },
];

const POINTS = [
  { icon: FileSearch, key: "p1" },
  { icon: BadgeCheck, key: "p2" },
  { icon: Lock, key: "p3" },
] as const;

/** Shared frame for sign in / sign up / officer request: brand panel (lg+), mode switcher, then the form. */
export default function AuthShell({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const t = useTranslations("authShell");
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-line lg:shadow-raised">
      <aside className="hidden flex-col justify-between gap-8 bg-brand-gradient p-8 text-white/95 lg:flex">
        <div className="flex flex-col gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <ShieldCheck aria-hidden="true" className="h-7 w-7" />
          </span>
          <h2 className="text-heading-2">{t("panelTitle")}</h2>
          <p className="text-white/85">{t("panelBody")}</p>
        </div>
        <ul className="flex flex-col gap-4">
          {POINTS.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="text-sm text-white/90">{t(key)}</span>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex flex-col gap-5 bg-surface lg:p-8">
        <nav aria-label={t("switcher")} className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface-muted p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.mode}
              href={tab.href}
              aria-current={tab.mode === mode ? "page" : undefined}
              className={`flex min-h-10 items-center justify-center rounded-md px-2 py-1.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                tab.mode === mode ? "bg-surface text-primary shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t(tab.key)}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
