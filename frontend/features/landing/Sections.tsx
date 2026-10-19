import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Contact,
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
import Reveal from "@/components/Reveal";
import ArtCard from "@/components/ArtCard";
import NoticeList from "@/features/notices/NoticeList";
import { localDigits } from "@/lib/intl-locale";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import FaqList from "@/features/info/FaqList";
import { HOME_FAQ_IDS } from "@/features/info/pages";
import { SERVICE_ART, TOOL_ART } from "./Illustrations";

/** Services whose route is not built yet stay hidden until their F-phase lands (track = F2c, now live). */
export const FLAGS = { track: true } as const;

const SERVICES = [
  { key: "verify", href: "/verify", icon: SearchCheck },
  { key: "check", href: "/check", icon: ListChecks },
  { key: "track", href: "/track", icon: Route },
  { key: "verifyDoc", href: "/verify-document", icon: FileCheck2 },
  { key: "myLands", href: "/my/lands", icon: Contact },
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

const h2 = "section-title text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]";
const icon = "h-5 w-5 shrink-0 text-ink-muted";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** Landing section, separated by a thin rule that fades at both ends. `panel` groups the section in a tinted rounded panel. */
function Band({ id, panel, children }: { id: string; panel?: boolean; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="relative py-10 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-line before:to-transparent sm:py-14"
    >
      <Reveal>{panel ? <div className="section-panel p-5 sm:p-8">{children}</div> : children}</Reveal>
    </section>
  );
}

/** "More" link under a section: green text with an arrow that slides on hover. */
function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="mt-6">
      <Link href={href} className={`group inline-flex min-h-touch items-center gap-1.5 rounded-md font-semibold text-primary underline-offset-4 hover:underline ${focus}`}>
        {children}
        <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </p>
  );
}


/** An odd last tile is centred under the two columns, as in CitizenTools. */
export function ServiceTiles() {
  const t = useTranslations("landing.services");
  return (
    <Band id="services-title">
      <h2 id="services-title" className={h2}>{t("title")}</h2>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {SERVICES.filter((s) => s.key !== "track" || FLAGS.track).map(({ key, href, icon }) => (
          <li key={key} className="sm:odd:last:col-span-2 sm:odd:last:mx-auto sm:odd:last:w-[calc(50%-0.625rem)]">
            <ArtCard href={href} testId="service-tile" icon={icon} art={SERVICE_ART[key]} title={t(`${key}.title`)} desc={t(`${key}.desc`)} />
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
    <Band id="tools-title">
      <h2 id="tools-title" className={h2}>{t("title")}</h2>
      <p className="mt-3 max-w-3xl text-ink-muted">{t("intro")}</p>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {TOOL_TILES.map(({ key, href, icon }) => (
          <li key={key} className="sm:last:col-span-2 sm:last:mx-auto sm:last:w-[calc(50%-0.625rem)]">
            <ArtCard href={href} testId="tool-tile" icon={icon} art={TOOL_ART[key]} title={tt(`${key}.title`)} desc={tt(`${key}.desc`)} />
          </li>
        ))}
      </ul>
      <MoreLink href="/tools">{t("cta")}</MoreLink>
    </Band>
  );
}

export function WhatWeCheck() {
  const t = useTranslations("landing.checks");
  return (
    <Band id="checks-title" panel>
      <h2 id="checks-title" className={h2}>{t("title")}</h2>
      <p className="mt-3 max-w-3xl text-ink-muted">{t("intro")}</p>
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
  const locale = useLocale();
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
              <span className="sr-only">{t("step", { n: localDigits(i + 1, locale) })}: </span>
              <span aria-hidden="true">{localDigits(i + 1, locale)}</span>
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
    <Band id="trust-title" panel>
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

/** Dated notices: admin-managed (U3.6), with the built-in demo samples as the fallback. The list itself is a client component. */
export function NoticeBoard() {
  const t = useTranslations("landing.notices");
  return (
    <Band id="notices-title">
      <h2 id="notices-title" className={h2}>{t("title")}</h2>
      <p className="mt-3 max-w-3xl text-ink-muted">{t("intro")}</p>
      <NoticeList />
      <MoreLink href="/services">{t("services")}</MoreLink>
    </Band>
  );
}

/** Top five questions as an accordion; "আরও" opens the full list on /faq. */
export function HomeFaq() {
  const t = useTranslations("landing.faq");
  return (
    <Band id="faq-title">
      <h2 id="faq-title" className={h2}>{t("title")}</h2>
      <p className="mt-3 max-w-3xl text-ink-muted">{t("intro")}</p>
      <div className="mt-6 max-w-3xl">
        <FaqList ids={HOME_FAQ_IDS} limit={HOME_FAQ_IDS.length} testId="faq-item" />
      </div>
      <MoreLink href="/faq">{t("more")}</MoreLink>
    </Band>
  );
}

/** Help strip (U1.6), last band on the home page: "still stuck?" with a way to write to us. */
export function HelpStrip() {
  const t = useTranslations("landing.help");
  return (
    <section aria-labelledby="help-title" className="relative py-10 sm:py-14">
      <Reveal>
        <div className="section-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <h2 id="help-title" className={h2}>{t("title")}</h2>
            <p className="mt-2 max-w-xl text-ink-muted">{t("body")}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            <Link href="/feedback" className={`btn-gold inline-flex min-h-touch items-center justify-center rounded-lg px-6 py-2 text-lg font-extrabold ${focus}`}>
              {t("write")}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
