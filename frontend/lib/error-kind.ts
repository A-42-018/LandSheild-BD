import { ApiError } from "@/lib/api";

/** What went wrong, in the terms a visitor can act on (U4.5). */
export type ErrorKind = "forbidden" | "signedOut" | "offline" | "tooMany" | "server" | "other";

export function errorKind(error: unknown): ErrorKind {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "offline";
    if (error.status === 401) return "signedOut";
    if (error.status === 403) return "forbidden";
    if (error.status === 429) return "tooMany";
    if (error.status >= 500) return "server";
    return "other";
  }
  // fetch() rejects with a TypeError when the phone has no connection
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return "other";
}
