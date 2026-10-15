import { setRequestLocale } from "next-intl/server";
import Backdrop from "@/features/landing/Backdrop";
import Hero from "@/features/landing/Hero";
import { CitizenTools, HowItWorks, NoticeBoard, ServiceTiles, Trust, WhatWeCheck } from "@/features/landing/Sections";

/** U5 landing (roadmap 4.7): search hero → service tiles → what we check → how it works → trust. */
export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <>
      <Backdrop />
      <Hero />
      <ServiceTiles />
      <NoticeBoard />
      <WhatWeCheck />
      <CitizenTools />
      <HowItWorks />
      <Trust />
    </>
  );
}
