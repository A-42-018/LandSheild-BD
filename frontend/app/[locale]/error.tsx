"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errorPages");
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold text-ink">{t("errorTitle")}</h1>
      <p className="text-ink-muted">{t("errorBody")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={reset}>{t("retry")}</Button>
        <Link href="/" className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
