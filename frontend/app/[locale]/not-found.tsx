import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StateCard } from "@/components/ui";
import { LostPlotArt } from "@/features/landing/Illustrations";

export default function NotFound() {
  const t = useTranslations("errorPages");
  return (
    <StateCard
      art={<LostPlotArt />}
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      actions={
        <Link href="/" className="btn-gold inline-flex min-h-12 items-center rounded-xl px-5 font-semibold">
          {t("goHome")}
        </Link>
      }
    />
  );
}
