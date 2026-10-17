import { Calculator, FileCheck2, ListChecks, Map as MapIcon, Route, SearchCheck, type LucideIcon } from "lucide-react";
import media from "./media.json";

/** Picture guides on /guide (U4.1), one per public service, in the order a citizen meets them.
 *  Text: messages `guide.items.<id>` (title, intro, steps s1–s3 with an image description each).
 *  Pictures and videos: `public/guide/`, made by `scripts/guide_media.sh` from the same text (re-run it after a UI change). */
export const GUIDE_IDS = ["verify", "check", "track", "verifyDoc", "map", "tools"] as const;
export type GuideId = (typeof GUIDE_IDS)[number];

export const STEP_IDS = ["s1", "s2", "s3"] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Guide {
  id: GuideId;
  /** The service page the "try it yourself" button opens. */
  href: string;
  icon: LucideIcon;
  /** The service itself needs sign-in (the guide page never does). */
  signIn: boolean;
}

export const GUIDES: readonly Guide[] = [
  { id: "verify", href: "/verify", icon: SearchCheck, signIn: false },
  { id: "check", href: "/check", icon: ListChecks, signIn: true },
  { id: "track", href: "/track", icon: Route, signIn: false },
  { id: "verifyDoc", href: "/verify-document", icon: FileCheck2, signIn: false },
  { id: "map", href: "/map", icon: MapIcon, signIn: false },
  { id: "tools", href: "/tools", icon: Calculator, signIn: false },
];

/** Screenshot size in CSS pixels (a 390 px wide phone screen, saved at 2×). */
export const SHOT = { width: 390, height: 700 } as const;

/** Step picture for the page language. English pages get English screenshots. */
export const shotSrc = (id: GuideId, step: StepId, locale: string) => `/guide/${locale === "bn" ? "bn" : "en"}/${id}-${step}.webp`;

/** Video, poster and captions. Videos show the Bangla screens with a Bangla voice-over in both languages; captions exist in both. */
export const videoOf = (id: GuideId) => {
  const v = (media as Record<string, { seconds: number } | undefined>)[id];
  return v
    ? { src: `/guide/video/${id}.mp4`, poster: `/guide/video/${id}.webp`, captions: (lang: "bn" | "en") => `/guide/video/${id}.${lang}.vtt`, seconds: v.seconds }
    : null;
};

/** Anchor of one guide on /guide, so other pages can link straight to it (`/guide#guide-track`). */
export const guideAnchor = (id: GuideId) => `guide-${id}`;
