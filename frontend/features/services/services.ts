export const SERVICE_IDS = ["verify", "check", "track", "verifyDoc"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export const SERVICE_HREF: Record<ServiceId, string> = {
  verify: "/verify",
  check: "/check",
  track: "/track",
  verifyDoc: "/verify-document",
};
