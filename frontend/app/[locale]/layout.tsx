import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import Footer from "@/features/landing/Footer";
import PageHelpful from "@/features/feedback/PageHelpful";
import Providers from "@/features/Providers";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("appName"), description: t("tagline") };
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
  // Server-side copy of the saved theme (cookie written by lib/theme.ts) so the class survives language switches without a light flash.
  const dark = cookies().get("ls-theme")?.value === "dark";

  return (
    <html lang={locale} className={`${inter.variable} ${bengali.variable}${dark ? " dark" : ""}`} suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" />
      </head>
      <body className={locale === "bn" ? "font-bn" : "font-sans"}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 print:hidden"
          >
            {t("skipToContent")}
          </a>
          <div className="contents print:hidden">
            <Header />
          </div>
          <main id="main" className="mx-auto max-w-[1200px] px-4 py-8 print:max-w-none print:p-0">
            {children}
            <PageHelpful />
          </main>
          <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
