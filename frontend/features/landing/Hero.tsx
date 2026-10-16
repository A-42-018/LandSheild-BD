import { useTranslations } from "next-intl";
import HeroSearch from "./HeroSearch";

/** U1.3 hero: H1 and one-line sub on the photo banner, then the tabbed search card (P1, P3) lifted over its lower edge.
 *  Photo banner: the photo is a decorative CSS background (.hero-banner in globals.css), so it adds no <img> and no alt text.
 *  The card is a solid surface, so no text sits on the photo except the heading block. */
export default function Hero() {
  const t = useTranslations();
  return (
    <section aria-labelledby="hero-title" className="pb-6 pt-2 sm:pb-6 sm:pt-4">
      <div className="hero-banner flex min-h-[20rem] items-end px-6 pb-20 pt-36 sm:px-10 md:min-h-[14rem] md:items-center md:pb-24 md:pt-9 lg:px-14">
        <div className="max-w-md lg:max-w-xl">
          <h1 id="hero-title" className="text-[2rem] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.35)] sm:text-[2.6rem]">
            {t("home.title")}
          </h1>
          <span aria-hidden="true" className="mt-4 block h-[3px] w-14 rounded-full bg-gradient-to-r from-gold to-gold/30" />
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/85">{t("home.intro")}</p>
        </div>
      </div>
      <div className="relative z-10 -mt-14 px-3 sm:px-6 lg:px-10">
        <HeroSearch />
      </div>
    </section>
  );
}
