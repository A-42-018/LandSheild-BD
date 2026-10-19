import { GUIDE_IDS, type GuideId } from "@/features/guide/guides";

export const SERVICE_IDS = ["verify", "check", "track", "verifyDoc", "myLands"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export const SERVICE_HREF: Record<ServiceId, string> = {
  verify: "/verify",
  check: "/check",
  track: "/track",
  verifyDoc: "/verify-document",
  myLands: "/my/lands",
};

/** The picture guide for a service, or null when /guide has none (My land has no guide yet). */
export const guideOf = (id: ServiceId): GuideId | null => ((GUIDE_IDS as readonly string[]).includes(id) ? (id as GuideId) : null);
