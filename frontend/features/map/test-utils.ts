import { vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { MapCollectionDto } from "./types";

export const gf = (id: string, name: string, bn: string, extra: Record<string, unknown> = {}) => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[89, 22], [90, 22], [90, 23], [89, 22]]] },
  properties: { id, name, bn_name: bn, bbox: [89, 22, 90, 23], lat: 22.5, long: 89.5, ...extra },
});
export const fc = (...f: unknown[]) => ({ type: "FeatureCollection", features: f });
export const GIS: Record<string, unknown> = {
  "/gis/capabilities": { mouza_enabled: true, mouza_enabled_division_id: "4", mouza_enabled_division_name: "Khulna", counts: {}, mouza_count: 0 },
  "/gis/divisions": fc(gf("4", "Khulna", "খুলনা"), gf("3", "Dhaka", "ঢাকা")),
  "/gis/districts?division_id=4": fc(gf("55", "Bagerhat", "বাগেরহাট", { division_id: "4" })),
  "/gis/upazilas?district_id=55": fc(gf("273", "Kachua", "কচুয়া", { division_id: "4", district_id: "55" })),
  "/gis/unions?upazila_id=273": { enabled: true, upazila_id: "273", unions: [] },
  "/gis/mouzas?upazila_id=273": { enabled: true, upazila_id: "273", mouzas: [] },
};
export const route = (d: MapCollectionDto, extra: Record<string, unknown> = {}) =>
  vi.fn((p: string): Promise<any> => {
    const all: Record<string, unknown> = { ...GIS, ...extra, "/lands/map": d, "/public/map": d };
    return p in all ? Promise.resolve(all[p]) : Promise.reject(new ApiError(404, "X", "x"));
  });

