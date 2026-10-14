import { setRequestLocale } from "next-intl/server";
import WhatYouNeed from "@/features/services/WhatYouNeed";
import TrackView from "@/features/track/TrackView";

// Public (no login, no RequireRole): status, dates and office only.
export default function TrackPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4"><WhatYouNeed service="track" /></div>
      <TrackView />
    </div>
  );
}
