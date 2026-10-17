import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * U5.4: each page's own <title>, "<page> | LandShield BD" (template in app/[locale]/layout.tsx).
 * One shared title made every page sound the same to a screen reader, and Next's route announcer
 * stays silent when the title does not change, so a link click was never announced.
 * `key` is a full message key (normally the page's H1); tests/page-titles.test.ts checks every page.
 *
 *   export const generateMetadata = pageTitle("about.title");
 */
export function pageTitle(key: string) {
  return async ({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> => {
    const t = await getTranslations({ locale });
    return { title: t(key) };
  };
}
