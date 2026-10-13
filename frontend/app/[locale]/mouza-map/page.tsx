import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import MouzaMapView from "@/features/mouza/MouzaMapView";

// Every signed-in role (the GIS API is ANY_AUTH).
export default function MouzaMapPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-6xl">
      <RequireRole>
        <MouzaMapView />
      </RequireRole>
    </div>
  );
}
