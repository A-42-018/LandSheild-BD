import { setRequestLocale } from "next-intl/server";
import Hero from "@/features/landing/Hero";
import { CitizenTools, HelpStrip, HomeFaq, HowItWorks, NoticeBoard, ServiceTiles, StatsBand, Trust, WhatWeCheck } from "@/features/landing/Sections";

/** U5 landing (roadmap 4.7): search hero → service tiles → notices → what we check → tools → তথ্যচিত্র → how it works → trust → FAQ → hotline strip. */
export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <ServiceTiles />
      <NoticeBoard />
      <WhatWeCheck />
      <CitizenTools />
      <StatsBand />
      <HowItWorks />
      <Trust />
      <HomeFaq />
      <HelpStrip />
    </>
  );
}
