import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import HeaderMenu from "@/components/HeaderMenu";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

/** Solid primary header with a 2 px accent rule; language and light/dark toggles sit in the bar next to the account button. */
export default function Navbar() {
  const t = useTranslations("common");
  return (
    <>
      <header className="header-glass sticky top-0 z-[1500] text-white">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
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
          <HeaderMenu
            controls={
              <>
                <LanguageSwitcher variant="header" />
                <ThemeToggle variant="icon" />
              </>
            }
          />
        </div>
      </header>
    </>
  );
}
