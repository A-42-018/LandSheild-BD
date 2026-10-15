import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileCheck2,
  FileClock,
  FileText,
  FlaskConical,
  Gavel,
  Landmark,
  ListChecks,
  QrCode,
  Route,
  Ruler,
  Scale,
  ScanLine,
  ScrollText,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/lib/intl-locale";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { SERVICE_ART } from "./Illustrations";

/** Services whose route is not built yet stay hidden until their F-phase lands (track = F2c, now live). */
export const FLAGS = { track: true } as const;

const SERVICES = [
  { key: "verify", href: "/verify", icon: SearchCheck },
  { key: "check", href: "/check", icon: ListChecks },
  { key: "track", href: "/track", icon: Route },
  { key: "verifyDoc", href: "/verify-document", icon: FileCheck2 },
] as const;
const TOOL_TILES = [
  { key: "units", href: "/tools/units", icon: Ruler },
  { key: "fees", href: "/tools/fees", icon: Calculator },
  { key: "faraid", href: "/tools/inheritance", icon: Scale },
] as const;
const CHECKS: [string, LucideIcon][] = [
  ["doubleSale", Copy],
  ["owner", UserCheck],
  ["mutation", FileClock],
  ["cases", Gavel],
  ["khas", Landmark],
  ["document", BadgeCheck],
];
const STEPS: [string, LucideIcon][] = [
  ["scan", ScanLine],
  ["extract", FileText],
  ["review", UserCheck],
  ["risk", ShieldAlert],
  ["report", QrCode],
];
const TRUST: [string, LucideIcon][] = [
  ["human", UserCheck],
  ["evidence", ListChecks],
  ["audit", ShieldCheck],
  ["demo", FlaskConical],
  ["noLegal", Scale],
];

const h2 = "text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]";
const icon = "h-5 w-5 shrink-0 text-ink-muted";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** Landing section: one page background throughout, sections separated by a thin rule and spacing (no alternating colour bands). */
function Band({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-8 sm:py-12">
      {children}
    </section>
  );
}

export function ServiceTiles() {
  const t = useTranslations("landing.services");
  return (
    <Band id="services-title">
      <h2 id="services-title" className={h2}>{t("title")}</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
        {SERVICES.filter((s) => s.key !== "track" || FLAGS.track).map(({ key, href, icon: I }) => {
          const ArtFor = SERVICE_ART[key];
          return (
            <li key={key}>
              <Link
                href={href}
                data-testid="service-tile"
                className={`glass-card glass-card-link group relative flex h-full min-h-[8rem] items-start gap-3 p-5 pr-[7.5rem] sm:min-h-[8.75rem] sm:pr-[10rem] ${focus}`}
              >
                <I aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-[1.0625rem] font-semibold text-ink">
                    {t(`${key}.title`)}
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 -translate-x-1 text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{t(`${key}.desc`)}</span>
                </span>
                <ArtFor className="pointer-events-none absolute -top-5 right-1 h-[7.5rem] w-[7.5rem] drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03] sm:-top-7 sm:right-2 sm:h-[9.5rem] sm:w-[10rem]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Band>
  );
}

export function CitizenTools() {
  const t = useTranslations("landing.tools");
  const tt = useTranslations("tools");
  return (
    <Band id="tools-title">
      <h2 id="tools-title" className={h2}>{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
        {TOOL_TILES.map(({ key, href, icon: I }) => (
          <li key={key}>
            <Link href={href} data-testid="tool-tile" className={`glass-card glass-card-link flex h-full min-h-11 items-start gap-3 p-4 ${focus}`}>
              <span className="icon-tile"><I aria-hidden="true" className="h-5 w-5" /></span>
              <span className="flex-1">
                <span className="block font-semibold text-ink">{tt(`${key}.title`)}</span>
                <span className="mt-1 block text-sm text-ink-muted">{tt(`${key}.desc`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4"><Link href="/tools" className="text-link underline-offset-2 hover:underline">{t("cta")}</Link></p>
    </Band>
  );
}

export function WhatWeCheck() {
  const t = useTranslations("landing.checks");
  return (
    <Band id="checks-title">
      <h2 id="checks-title" className={h2}>{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHECKS.map(([k, I]) => (
          <li key={k} data-testid="check-item" className="glass-card flex items-center gap-3 p-3.5 text-ink">
            <span className="icon-tile"><I aria-hidden="true" className="h-5 w-5" /></span>
            <span className="font-medium">{t(`items.${k}`)}</span>
          </li>
        ))}
      </ul>
    </Band>
  );
}

export function HowItWorks() {
  const t = useTranslations("landing.how");
  return (
    <Band id="how-title">
      <h2 id="how-title" className={h2}>{t("title")}</h2>
      <ol className="mt-7 grid gap-5 lg:grid-cols-5 lg:gap-4">
        {STEPS.map(([k, I], i) => (
          <li
            key={k}
            data-testid="how-step"
            className="relative flex gap-3 lg:flex-col lg:before:absolute lg:before:left-14 lg:before:right-2 lg:before:top-5 lg:before:border-t-2 lg:before:border-dashed lg:before:border-primary/30 lg:last:before:hidden"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover font-bold text-primary-fg shadow-[0_6px_16px_-6px_rgb(var(--primary)/0.7)] ring-4 ring-primary/10">
              <span className="sr-only">{t("step", { n: i + 1 })}: </span>
              <span aria-hidden="true">{i + 1}</span>
            </span>
            <span>
              <span className="flex items-center gap-2 font-semibold text-ink">
                <I aria-hidden="true" className={icon} />
                {t(`steps.${k}.title`)}
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{t(`steps.${k}.desc`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </Band>
  );
}

export function Trust() {
  const t = useTranslations("landing.trust");
  return (
    <Band id="trust-title">
      <h2 id="trust-title" className={h2}>{t("title")}</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TRUST.map(([k, I]) => (
          <li key={k} data-testid="trust-item" className="glass-card flex items-start gap-3 p-4 lg:flex-col">
            <span className="icon-tile"><I aria-hidden="true" className="h-5 w-5" /></span>
            <div>
              <h3 className="font-semibold text-ink">{t(`items.${k}.title`)}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t(`items.${k}.desc`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Band>
  );
}

const NOTICES = [
  { id: "n1", date: "2026-10-14" },
  { id: "n2", date: "2026-10-12" },
  { id: "n3", date: "2026-10-07" },
  { id: "n4", date: "2026-10-06" },
] as const;

/** Dated demo notices (synthetic): what changed in the prototype. */
export function NoticeBoard() {
  const t = useTranslations("landing.notices");
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeZone: "UTC" });
  return (
    <Band id="notices-title">
      <h2 id="notices-title" className={h2}>{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {NOTICES.map((n) => (
          <li key={n.id} data-testid="notice-item" className="glass-card border-l-4 !border-l-primary p-4">
            <time dateTime={n.date} className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{fmt.format(new Date(n.date))}</time>
            <p className="mt-1 font-semibold text-ink">{t(`items.${n.id}.title`)}</p>
            <p className="mt-1 text-sm text-ink-muted">{t(`items.${n.id}.body`)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4"><Link href="/services" className="text-link underline-offset-2 hover:underline">{t("services")}</Link></p>
    </Band>
  );
}
