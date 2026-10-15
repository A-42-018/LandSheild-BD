"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, StateCard } from "@/components/ui";
import { LostPlotArt } from "@/features/landing/Illustrations";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errorPages");
  return (
    <StateCard
      role="alert"
      art={<LostPlotArt />}
      title={t("errorTitle")}
      body={t("errorBody")}
      actions={
        <>
          <Button size="lg" onClick={reset}>{t("retry")}</Button>
          <Link href="/" className="inline-flex min-h-12 items-center rounded-xl px-4 font-medium text-link underline underline-offset-2">
            {t("goHome")}
          </Link>
        </>
      }
    />
  );
}
