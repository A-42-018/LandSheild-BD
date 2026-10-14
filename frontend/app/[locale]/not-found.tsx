import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/components/PageHeader";

export default function NotFound() {
  const t = useTranslations("errorPages");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("notFoundTitle")} purpose={t("notFoundBody")} />
      <p>
        <Link href="/" className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
          {t("goHome")}
        </Link>
      </p>
    </div>
  );
}
