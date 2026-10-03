import { setRequestLocale } from "next-intl/server";
import Hero from "@/features/landing/Hero";
import Stats from "@/features/landing/Stats";
import { Features, HowItWorks, Problem, Trust } from "@/features/landing/Sections";

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Stats />
      <Problem />
      <HowItWorks />
      <Features />
      <Trust />
    </>
  );
}
