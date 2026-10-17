import { notFound } from "next/navigation";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("errorPages.notFoundTitle");

/** Unknown URLs under a locale render the localized not-found page instead of the bare Next.js 404. */
export default function CatchAll() {
  notFound();
}
