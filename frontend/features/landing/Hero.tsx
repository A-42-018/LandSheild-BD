import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import VerifyForm from "@/features/verify/VerifyForm";
import { FLAGS } from "./Sections";

/** U5 (roadmap 4.7 item 1): service-first hero — H1, one-line sub, inline land search. No image, no logo card. */
export default function Hero() {
  const t = useTranslations();
  return (
    <section aria-labelledby="hero-title" className="-mt-8 py-8 sm:py-12">
      <h1 id="hero-title" className="text-[1.875rem] font-bold leading-tight text-ink sm:text-[2rem]">
        {t("home.title")}
      </h1>
      <p className="mt-2 max-w-3xl text-ink-muted">{t("home.intro")}</p>
      <div className="mt-5 rounded-md border border-line bg-surface p-4 sm:p-5" data-testid="hero-search">
        <VerifyForm compact />
      </div>
      {FLAGS.track && (
        <Link
          href="/track"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-link underline-offset-2 hover:underline"
        >
          {t("landing.trackLink")}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}
