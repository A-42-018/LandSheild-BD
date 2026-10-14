import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import HeaderMenu from "@/components/HeaderMenu";
import TopStrip from "@/components/TopStrip";

/** Top strip + solid primary header with a 2 px accent rule (U3). No glass, no gradient. */
export default function Navbar() {
  const t = useTranslations("common");
  return (
    <>
      <TopStrip />
      <header className="header-glass sticky top-0 z-[1500] text-white">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-0 px-4 py-2">
          <Link
            href="/"
            className="mr-2 flex items-center gap-2.5 rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" alt="" width={64} height={64} className="h-10 w-10 object-contain" />
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-bold">{t("appName")}</span>
              <span className="text-xs font-normal text-white/90" lang="bn" aria-hidden="true">{t("subLine")}</span>
            </span>
          </Link>
          <HeaderMenu controls={null} />
        </div>
      </header>
    </>
  );
}
