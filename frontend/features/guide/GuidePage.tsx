import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, CirclePlay, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { ChecklistArt } from "@/features/landing/Illustrations";
import { localDigits } from "@/lib/intl-locale";
import MoreGuides from "./MoreGuides";
import { GUIDES, SHOT, STEP_IDS, guideAnchor, shotSrc, videoOf, type Guide } from "./guides";

const PICK = "guide-pick";

/** "৪৫ সেকেন্ড" / "1 min 5 s", digits in the page language. */
function useLength() {
  const t = useTranslations("guide.video");
  const locale = useLocale();
  return (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? t("minSec", { m: localDigits(m, locale), s: localDigits(s, locale) }) : t("sec", { s: localDigits(s, locale) });
  };
}

function GuideVideo({ guide }: { guide: Guide }) {
  const t = useTranslations("guide.video");
  const locale = useLocale();
  const length = useLength();
  const v = videoOf(guide.id);
  if (!v) return null;
  return (
    <details className="group mt-4 rounded-xl border border-line/70 bg-surface/60" data-testid="guide-video">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
        <CirclePlay aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
        <span className="flex-1">{t("watch", { length: length(v.seconds) })}</span>
        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col items-center gap-2 px-4 pb-4">
        {/* preload="none": nothing is downloaded until the visitor presses play (low-bandwidth phones) */}
        <video
          controls
          playsInline
          preload="none"
          poster={v.poster}
          className="max-h-[70vh] w-auto max-w-full rounded-lg border border-line bg-black"
          width={SHOT.width}
          height={SHOT.height}
        >
          <source src={v.src} type="video/mp4" />
          <track kind="captions" src={v.captions("bn")} srcLang="bn" label={t("captionsBn")} default={locale === "bn"} />
          <track kind="captions" src={v.captions("en")} srcLang="en" label={t("captionsEn")} default={locale !== "bn"} />
          {t("unsupported")}
        </video>
        <p className="text-sm text-ink-muted">{t("note")}</p>
      </div>
    </details>
  );
}

function GuideSection({ guide }: { guide: Guide }) {
  const t = useTranslations("guide");
  const locale = useLocale();
  const { id, href, icon: Icon, signIn } = guide;
  const anchor = guideAnchor(id);
  const Lock = signIn ? LockKeyhole : LockKeyholeOpen;
  return (
    <section id={anchor} aria-labelledby={`${anchor}-h`} className="glass-card scroll-mt-28 p-5 sm:p-6" data-testid="guide-section">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="icon-tile"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id={`${anchor}-h`} className="section-title text-xl font-semibold text-ink">{t(`items.${id}.title`)}</h2>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-0.5 text-sm text-ink-muted">
            <Lock aria-hidden="true" className="h-4 w-4" />
            {t(signIn ? "signIn" : "noSignIn")}
          </p>
        </div>
      </div>
      <p className="mt-3 max-w-[70ch] text-ink-muted">{t(`items.${id}.intro`)}</p>
      <GuideVideo guide={guide} />
      <ol className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("stepsLabel", { title: t(`items.${id}.title`) })}>
        {STEP_IDS.map((s, i) => (
          <li key={s} className="flex flex-col gap-3" data-testid="guide-step">
            <Image
              src={shotSrc(id, s, locale)}
              alt={t(`items.${id}.steps.${s}.alt`)}
              width={SHOT.width}
              height={SHOT.height}
              sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 90vw"
              unoptimized
              className="mx-auto h-auto w-full max-w-[18rem] rounded-2xl border-4 border-ink/80 bg-surface shadow-lift"
            />
            <div>
              <p className="inline-flex min-w-8 items-center justify-center rounded-full bg-primary px-3 py-0.5 text-sm font-semibold text-primary-fg">
                {t("step", { n: localDigits(i + 1, locale) })}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-ink">{t(`items.${id}.steps.${s}.title`)}</h3>
              <p className="mt-1 text-ink-muted">{t(`items.${id}.steps.${s}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={href}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-primary-fg shadow-[0_6px_16px_-6px_rgb(var(--primary)/0.55)] hover:bg-primary-hover"
        >
          {t("tryIt", { title: t(`items.${id}.title`) })}
          <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <a href={`#${PICK}`} className="inline-flex min-h-12 items-center text-link underline underline-offset-2">{t("allGuides")}</a>
      </div>
    </section>
  );
}

/** /guide (U4.1): pick a service from big tiles, then follow three pictured steps or watch a short video with a Bangla voice-over. */
export default function GuidePage() {
  const t = useTranslations("guide");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t("title")} purpose={t("purpose")} art={<ChecklistArt />} />
      <section id={PICK} aria-labelledby={`${PICK}-h`} className="glass-card scroll-mt-28 p-5 sm:p-6">
        <h2 id={`${PICK}-h`} className="section-title text-xl font-semibold text-ink">{t("pickTitle")}</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GUIDES.map(({ id, icon: Icon }) => (
            <li key={id}>
              <a
                href={`#${guideAnchor(id)}`}
                data-testid="guide-tile"
                className="glass-card glass-card-link flex h-full min-h-24 flex-col items-center justify-center gap-2 p-4 text-center font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span aria-hidden="true" className="icon-tile"><Icon className="h-5 w-5" /></span>
                {t(`items.${id}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </section>
      {GUIDES.map((g) => <GuideSection key={g.id} guide={g} />)}
      <MoreGuides />
      <p className="text-sm text-ink-muted">{t("demoNote")}</p>
    </div>
  );
}
