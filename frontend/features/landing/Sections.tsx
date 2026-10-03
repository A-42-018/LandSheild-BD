import {
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  FlaskConical,
  History,
  KeyRound,
  Languages,
  Layers,
  ListChecks,
  Scale,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

const STEPS = ["upload", "extract", "review", "verify", "analyze", "report"] as const;
const FEATURES = ["extraction", "evidence", "timeline", "review", "report"] as const;
const TRUST = ["human", "noLegal", "audit", "access", "demo"] as const;
const PROBLEMS = ["p1", "p2", "p3"] as const;

const STEP_ICON: Record<(typeof STEPS)[number], LucideIcon> = {
  upload: Upload,
  extract: FileText,
  review: UserCheck,
  verify: Search,
  analyze: ShieldAlert,
  report: ScrollText,
};
const FEATURE_ICON: Record<(typeof FEATURES)[number], LucideIcon> = {
  extraction: Languages,
  evidence: ListChecks,
  timeline: History,
  review: ClipboardCheck,
  report: ScrollText,
};
const TRUST_ICON: Record<(typeof TRUST)[number], LucideIcon> = {
  human: UserCheck,
  noLegal: Scale,
  audit: ShieldCheck,
  access: KeyRound,
  demo: FlaskConical,
};
const PROBLEM_ICON: Record<(typeof PROBLEMS)[number], LucideIcon> = { p1: Layers, p2: Copy, p3: Clock };

const card = "rounded-xl border border-line bg-surface p-5 shadow-card";
const h2 = "text-2xl font-bold text-primary";
const chip = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary";

function Icon({ icon: I }: { icon: LucideIcon }) {
  return (
    <span className={chip}>
      <I aria-hidden="true" className="h-5 w-5" />
    </span>
  );
}

export function Problem() {
  const t = useTranslations("landing.problem");
  return (
    <section aria-labelledby="problem-title" className="mt-12">
      <h2 id="problem-title" className={h2}>
        {t("title")}
      </h2>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("body")}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {PROBLEMS.map((k) => (
          <li key={k} className={`${card} flex items-start gap-3 text-sm text-ink`}>
            <Icon icon={PROBLEM_ICON[k]} />
            <span>{t(k)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks() {
  const t = useTranslations("landing.how");
  return (
    <section aria-labelledby="how-title" className="mt-12">
      <h2 id="how-title" className={h2}>
        {t("title")}
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((k, i) => (
          <li key={k} className={`${card} border-t-4 border-t-primary`} data-testid="how-step">
            <div className="flex items-center gap-3">
              <Icon icon={STEP_ICON[k]} />
              <span className="text-sm font-semibold text-primary">{t("step", { n: i + 1 })}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-ink">{t(`steps.${k}.title`)}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t(`steps.${k}.desc`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Features() {
  const t = useTranslations("landing.features");
  return (
    <section aria-labelledby="features-title" className="mt-12">
      <h2 id="features-title" className={h2}>
        {t("title")}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((k) => (
          <li key={k} className={card} data-testid="feature">
            <Icon icon={FEATURE_ICON[k]} />
            <h3 className="mt-3 text-lg font-semibold text-ink">{t(`items.${k}.title`)}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t(`items.${k}.desc`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Trust() {
  const t = useTranslations("landing.trust");
  return (
    <section
      aria-labelledby="trust-title"
      className="mt-12 rounded-2xl border border-line bg-brand-gradient-soft p-5 sm:p-8"
    >
      <h2 id="trust-title" className={h2}>
        {t("title")}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {TRUST.map((k) => (
          <li key={k} className={`${card} flex items-start gap-3`} data-testid="trust-item">
            <Icon icon={TRUST_ICON[k]} />
            <div>
              <h3 className="text-base font-semibold text-ink">{t(`items.${k}.title`)}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t(`items.${k}.desc`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
