import { setRequestLocale } from "next-intl/server";
import TrackView from "@/features/track/TrackView";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("track.title");

// Public (no login, no RequireRole): status, dates and office only.
export default function TrackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="track">
      <TrackView />
    </ClientMessages>
  );
}
