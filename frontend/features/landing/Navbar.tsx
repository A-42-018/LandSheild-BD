import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import HeaderMenu from "@/components/HeaderMenu";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  const t = useTranslations("common");
  return (
    <header className="header-glass sticky top-0 z-[1500] text-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-0 px-4 py-2">
        <Link
          href="/"
          className="mr-2 flex items-center gap-2.5 rounded-md text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {/* Transparent artwork: reads on both the light and the dark header. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="" width={820} height={608} className="h-10 w-auto object-contain drop-shadow-md" />
          <span>{t("appName")}</span>
        </Link>
        <HeaderMenu
          controls={
            <>
              <ThemeToggle variant="onBrand" />
              <LanguageSwitcher variant="onBrand" />
            </>
          }
        />
      </div>
    </header>
  );
}
