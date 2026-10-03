"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import type { ApiError } from "@/lib/api";
import type {
  GisCapabilitiesDto,
  GisCollectionDto,
  MouzaListDto,
  SearchResultDto,
} from "./types";

const STATIC = { staleTime: Infinity, retry: false } as const; // boundary data never changes at runtime

export function useGisCapabilities() {
  const { api } = useAuth();
  return useQuery<GisCapabilitiesDto, ApiError>({
    queryKey: ["gis", "capabilities"],
    queryFn: () => api.get<GisCapabilitiesDto>("/gis/capabilities"),
    ...STATIC,
  });
}

export function useDivisions() {
  const { api } = useAuth();
  return useQuery<GisCollectionDto, ApiError>({
    queryKey: ["gis", "divisions"],
    queryFn: () => api.get<GisCollectionDto>("/gis/divisions"),
    ...STATIC,
  });
}

export function useDistricts(divisionId: string) {
  const { api } = useAuth();
  return useQuery<GisCollectionDto, ApiError>({
    queryKey: ["gis", "districts", divisionId],
    queryFn: () => api.get<GisCollectionDto>(`/gis/districts?division_id=${encodeURIComponent(divisionId)}`),
    enabled: Boolean(divisionId),
    ...STATIC,
  });
}

export function useUpazilas(districtId: string) {
  const { api } = useAuth();
  return useQuery<GisCollectionDto, ApiError>({
    queryKey: ["gis", "upazilas", districtId],
    queryFn: () => api.get<GisCollectionDto>(`/gis/upazilas?district_id=${encodeURIComponent(districtId)}`),
    enabled: Boolean(districtId),
    ...STATIC,
  });
}

export function useMouzas(upazilaId: string) {
  const { api } = useAuth();
  return useQuery<MouzaListDto, ApiError>({
    queryKey: ["gis", "mouzas", upazilaId],
    queryFn: () => api.get<MouzaListDto>(`/gis/mouzas?upazila_id=${encodeURIComponent(upazilaId)}`),
    enabled: Boolean(upazilaId),
    ...STATIC,
  });
}

export function useGisSearch(q: string) {
  const { api } = useAuth();
  return useQuery<SearchResultDto, ApiError>({
    queryKey: ["gis", "search", q],
    queryFn: () => api.get<SearchResultDto>(`/gis/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    retry: false,
  });
}
