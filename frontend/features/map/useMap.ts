"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api";
import type { MapCollectionDto } from "./types";

export function useParcelMap() {
  const { api, status } = useAuth();
  const signedIn = status === "authenticated";
  return useQuery<MapCollectionDto, ApiError>({
    queryKey: ["lands", "map", signedIn ? "full" : "public"],
    enabled: status !== "loading",
    // Visitors get outlines + parcel numbers only (U2.3); signed-in users also get risk, status and area.
    queryFn: () => api.get<MapCollectionDto>(signedIn ? "/lands/map" : "/public/map"),
    retry: false, // the error state offers an explicit retry
  });
}
