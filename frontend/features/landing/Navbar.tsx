import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import HeaderMenu from "@/components/HeaderMenu";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

/** Decorative header texture: faint plot lines behind the logo and a "digital" column grid on the right. */
const COLS = Array.from({ length: 22 }, (_, i) => i);
function HeaderArt() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-y-0 left-0 h-full w-[46rem] max-w-full text-[#D6B25C]" viewBox="0 0 736 64" preserveAspectRatio="xMinYMid slice" fill="none">
        <path d="M-10,58L120,6M60,70L210,-8M150,66L260,10L330,40M-10,24L90,40L180,22M240,64L300,30L420,52M380,-4L470,40L560,18" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />
        <path d="M30,-6L70,70M200,-6L230,70M320,-6L300,70" stroke="currentColor" strokeOpacity="0.3" className="text-white/[0.17]" strokeWidth="1" />
      </svg>
      <div className="absolute inset-y-0 right-0 hidden w-[30rem] sm:block [mask-image:linear-gradient(to_right,transparent,#000_45%,#000)]">
        <svg className="h-full w-full text-[#7FE0B0]" viewBox="0 0 480 64" preserveAspectRatio="xMaxYMid slice">
          {COLS.map((i) => (
            <g key={i} fill="currentColor" fillOpacity={0.05 + ((i * 7) % 5) * 0.025}>
              {Array.from({ length: 5 }, (_, j) => (
                <rect key={j} x={i * 22 + 4} y={((i * 13 + j * 17) % 60) - 6} width="2" height={4 + ((i + j) % 4) * 3} rx="1" />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="absolute inset-y-0 left-1/3 w-1/3 bg-[radial-gradient(closest-side,rgb(255_255_255/0.06),transparent)]" />
    </div>
  );
}

/** Solid primary header with a 2 px accent rule; language and light/dark toggles sit in the bar next to the account button. */
export default function Navbar() {
  const t = useTranslations("common");
  return (
    <>
      <header className="header-glass sticky top-0 z-[1500] text-white">
        <HeaderArt />
        <div className="relative mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link
            href="/"
            className="mr-2 flex items-center gap-2.5 rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" alt="" width={64} height={64} className="h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]" />
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-extrabold uppercase tracking-wide">{t("appName")}</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/80" lang="bn" aria-hidden="true">{t("subLine")}</span>
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
