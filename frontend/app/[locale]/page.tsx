import { setRequestLocale } from "next-intl/server";
import Hero from "@/features/landing/Hero";
import { CitizenTools, HowItWorks, OfficerBand, ServiceTiles, Trust, WhatWeCheck } from "@/features/landing/Sections";

/** U5 landing (roadmap 4.7): search hero → service tiles → what we check → how it works → officers → trust. */
export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <ServiceTiles />
      <WhatWeCheck />
      <CitizenTools />
      <HowItWorks />
      <OfficerBand />
      <Trust />
    </>
  );
}
