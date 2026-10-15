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

const h2 = "text-2xl font-bold text-ink";
const icon = "h-5 w-5 shrink-0 text-ink-muted";
const TONE = {
  surface: "bg-surface shadow-[0_0_0_100vmax_rgb(var(--surface))]",
  muted: "",
  soft: "bg-primary-soft shadow-[0_0_0_100vmax_rgb(var(--primary-soft))]",
};

/** Full-bleed section band inside the centred <main>: background extends to the viewport edges without horizontal scroll. */
function Band({ id, tone, children }: { id: string; tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`py-8 [clip-path:inset(0_-100vmax)] sm:py-12 ${TONE[tone]}`}>
      {children}
    </section>
  );
}

export function ServiceTiles() {
  const t = useTranslations("landing.services");
  return (
    <Band id="services-title" tone="surface">
      <h2 id="services-title" className={h2}>{t("title")}</h2>
      <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
        {SERVICES.filter((s) => s.key !== "track" || FLAGS.track).map(({ key, href, icon: I }) => (
          <li key={key}>
            <Link
              href={href}
              data-testid="service-tile"
              className="flex h-full min-h-11 items-start gap-3 rounded-md border border-line bg-surface p-4 transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <I aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="block font-semibold text-ink">{t(`${key}.title`)}</span>
                <span className="mt-1 block text-sm text-ink-muted">{t(`${key}.desc`)}</span>
              </span>
              <ArrowRight aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </Band>
  );
}

export function CitizenTools() {
  const t = useTranslations("landing.tools");
  const tt = useTranslations("tools");
  return (
    <Band id="tools-title" tone="muted">
      <h2 id="tools-title" className={h2}>{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
        {TOOL_TILES.map(({ key, href, icon: I }) => (
          <li key={key}>
            <Link href={href} data-testid="tool-tile" className="flex h-full min-h-11 items-start gap-3 rounded-md border border-line bg-surface p-4 transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <I aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
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
    <Band id="checks-title" tone="muted">
      <h2 id="checks-title" className={h2}>{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHECKS.map(([k, I]) => (
          <li key={k} data-testid="check-item" className="flex items-start gap-3 border-b border-line pb-3 text-ink">
            <I aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>{t(`items.${k}`)}</span>
          </li>
        ))}
      </ul>
    </Band>
  );
}

export function HowItWorks() {
  const t = useTranslations("landing.how");
  return (
    <Band id="how-title" tone="surface">
      <h2 id="how-title" className={h2}>{t("title")}</h2>
      <ol className="mt-6 grid gap-5 lg:grid-cols-5 lg:gap-4">
        {STEPS.map(([k, I], i) => (
          <li
            key={k}
            data-testid="how-step"
            className="relative flex gap-3 lg:flex-col lg:before:absolute lg:before:left-12 lg:before:right-0 lg:before:top-5 lg:before:h-px lg:before:bg-line lg:last:before:hidden"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-fg">
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
    <Band id="trust-title" tone="muted">
      <h2 id="trust-title" className={h2}>{t("title")}</h2>
      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        {TRUST.map(([k, I]) => (
          <li key={k} data-testid="trust-item" className="flex items-start gap-3 lg:flex-col lg:gap-2">
            <I aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
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
    <Band id="notices-title" tone="soft">
      <h2 id="notices-title" className={h2}>{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {NOTICES.map((n) => (
          <li key={n.id} data-testid="notice-item" className="rounded-md border border-line bg-surface p-4">
            <time dateTime={n.date} className="text-sm font-medium text-primary">{fmt.format(new Date(n.date))}</time>
            <p className="mt-1 font-semibold text-ink">{t(`items.${n.id}.title`)}</p>
            <p className="mt-1 text-sm text-ink-muted">{t(`items.${n.id}.body`)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4"><Link href="/services" className="text-link underline-offset-2 hover:underline">{t("services")}</Link></p>
    </Band>
  );
}
