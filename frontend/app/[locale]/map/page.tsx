import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import MapView from "@/features/map/MapView";

export default function MapPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-6xl">
      <RequireRole>
        <MapView />
      </RequireRole>
    </div>
  );
}
