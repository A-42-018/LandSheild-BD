import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SHELL_MESSAGES, pickMessages } from "@/i18n/client-messages";
import Header from "@/components/Header";
import TopStrip from "@/components/TopStrip";
import NoticeTicker from "@/components/NoticeTicker";
import PublicBackdrop from "@/features/landing/PublicBackdrop";
import Footer from "@/features/landing/Footer";
import HelpButton from "@/components/HelpButton";
import PageHelpful from "@/features/feedback/PageHelpful";
import { BRAND_COLOR } from "@/lib/theme";
import Providers from "@/features/Providers";
import ServiceWorker from "@/features/pwa/ServiceWorker";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Wordmark / display face: sturdy geometric sans for the brand name (Latin only; Bangla falls back to Noto Sans Bengali).
const display = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});

export const viewport: Viewport = { themeColor: BRAND_COLOR };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "common" });
  // pages set their own part with lib/page-title.ts (U5.4); the home page keeps the bare name
  return { title: { default: t("appName"), template: `%s | ${t("appName")}` }, description: t("tagline") };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as "en" | "bn")) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} className={`${inter.variable} ${bengali.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        {/* Tells the browser the page handles dark mode itself (class + CSS color-scheme), so Chromium/Brave "auto dark mode" does not re-darken the light theme. */}
        <meta name="color-scheme" content="light dark" />
        <script src="/theme-init.js" />
      </head>
      <body className={locale === "bn" ? "font-bn" : "font-sans"}>
        {/* Only the shell's namespaces; routes add theirs with <ClientMessages> (i18n/client-messages.ts). */}
        <NextIntlClientProvider messages={pickMessages(messages, SHELL_MESSAGES)}>
          <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 print:hidden"
          >
            {t("skipToContent")}
          </a>
          <div className="contents print:hidden">
            <TopStrip />
            <Header />
            <NoticeTicker />
          </div>
          <PublicBackdrop />
          <main id="main" className="mx-auto max-w-[75rem] px-4 py-8 has-[[data-wide-page]]:max-w-[100rem] print:max-w-none print:p-0">
            {children}
            <PageHelpful />
          </main>
          <Footer />
          <HelpButton />
          <ServiceWorker />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
