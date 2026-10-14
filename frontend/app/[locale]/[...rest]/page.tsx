import { notFound } from "next/navigation";

/** Unknown URLs under a locale render the localized not-found page instead of the bare Next.js 404. */
export default function CatchAll() {
  notFound();
}
