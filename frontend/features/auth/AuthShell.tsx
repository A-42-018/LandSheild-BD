"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, FileSearch, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { contours } from "@/features/landing/Backdrop";
import { ShieldArt } from "@/features/landing/Illustrations";

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

const PANEL_RINGS = contours([{ cx: 360, cy: 120, rings: 7, step: 26, seed: 2.2 }]);

/** Shared frame for sign in / sign up / officer request, matching the landing look: one glass card with a brand panel
 *  and the form side with segmented tabs. Desktop: the panel holds a sticky, viewport-high photo frame (farmer with phone,
 *  title on a green fade at the top, the 3 points on a green fade at the bottom), so face and phone stay in view on one
 *  screen while a tall form (officer request) scrolls. The sticky top (6.625rem) is the frame's own resting position
 *  (header + page padding), so it never shifts before it pins; it leaves only with the card's end. On phones the panel shrinks to a short banner above the form. */
export default function AuthShell({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const t = useTranslations("authShell");
  return (
    <div className="glass-card mx-auto grid w-full max-w-5xl overflow-clip !rounded-[22px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="auth-panel relative overflow-clip text-white/95">
        <div className="auth-frame relative flex flex-col gap-8 overflow-hidden p-6 sm:p-8 lg:sticky lg:top-[6.625rem] lg:h-[min(calc(100dvh-7.625rem),52rem)] lg:min-h-[34rem] lg:justify-between lg:gap-6 lg:p-7">
          <div aria-hidden="true" className="auth-photo pointer-events-none absolute inset-0 hidden lg:block" />
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-gold" viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice" fill="none">
            <path d={PANEL_RINGS} stroke="currentColor" strokeOpacity="0.08" />
          </svg>
          <div className="relative flex items-center gap-4">
            <ShieldArt className="h-16 w-14 shrink-0 drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)] sm:h-20 sm:w-[4.5rem] lg:h-16 lg:w-14" />
            <div>
              <h2 className="text-[1.5rem] [text-shadow:0_2px_12px_rgb(0_0_0/0.45)] font-bold leading-tight tracking-tight sm:text-[1.75rem] lg:text-[1.6rem]">{t("panelTitle")}</h2>
              <span aria-hidden="true" className="mt-2.5 hidden h-[3px] w-12 rounded-full bg-gradient-to-r from-gold to-gold/30 lg:block" />
              <p className="mt-3 hidden leading-relaxed text-white/80 sm:block lg:hidden">{t("panelBody")}</p>
            </div>
          </div>
          <ul className="relative hidden flex-col gap-2 lg:flex [@media(max-height:700px)]:lg:hidden">
            {POINTS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#0A3527]/60 px-3 py-2.5 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-md">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-gold-soft">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-[0.8125rem] leading-snug text-white/90">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex flex-col gap-5 bg-surface/60 p-5 sm:p-8">
        <nav aria-label={t("switcher")} className="grid grid-cols-3 gap-1 rounded-xl border border-line/80 bg-surface-muted/80 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.mode}
              href={tab.href}
              aria-current={tab.mode === mode ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-lg px-2 py-1.5 text-center text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                tab.mode === mode
                  ? "bg-surface font-semibold text-primary shadow-[0_4px_12px_-4px_rgb(var(--shadow)/0.25)] ring-1 ring-primary/15"
                  : "text-ink-muted hover:bg-surface/60 hover:text-ink"
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
