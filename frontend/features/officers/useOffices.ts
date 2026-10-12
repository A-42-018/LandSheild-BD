"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import type { Office, OfficerRequestDraft, Place } from "./types";

const STALE = 60 * 60 * 1000; // the office list is static reference data

function usePlaces(path: string, enabled: boolean, key: unknown[]) {
  const { api } = useAuth();
  return useQuery<Place[], ApiError>({
    queryKey: ["offices", ...key],
    queryFn: () => api.get<Place[]>(path),
    enabled,
    staleTime: STALE,
  });
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const useDivisions = () => usePlaces("/offices/divisions", true, ["divisions"]);

export const useDistricts = (division: string) =>
  usePlaces(`/offices/districts?${q({ division })}`, !!division, ["districts", division]);

export const useUpazilas = (division: string, district: string) =>
  usePlaces(`/offices/upazilas?${q({ division, district })}`, !!district, ["upazilas", division, district]);

export function useOfficeList(division: string, district: string, upazila: string, enabled: boolean) {
  const { api } = useAuth();
  const params: Record<string, string> = { division, district };
  if (upazila) params.upazila = upazila;
  return useQuery<{ items: Office[]; total: number }, ApiError>({
    queryKey: ["offices", "list", division, district, upazila],
    queryFn: () => api.get(`/offices?${q(params)}`),
    enabled: enabled && !!district,
    staleTime: STALE,
  });
}

export function useOfficerRequest() {
  const { api } = useAuth();
  return useMutation<unknown, ApiError, OfficerRequestDraft>({
    mutationFn: (d) => api.post("/offices/officer-requests", d),
  });
}
