import { setRequestLocale } from "next-intl/server";
import MapView from "@/features/map/MapView";
import ClientMessages from "@/components/ClientMessages";

export default function MapPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="map">
      <div className="mx-auto max-w-6xl">
        {/* U2.3: public. Visitors get outlines + parcel numbers; signed-in users also get risk colours. */}
        <MapView />
      </div>
    </ClientMessages>
  );
}
