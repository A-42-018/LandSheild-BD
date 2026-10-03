"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api";
import type { MapCollectionDto } from "./types";

export function useParcelMap() {
  const { api } = useAuth();
  return useQuery<MapCollectionDto, ApiError>({
    queryKey: ["lands", "map"],
    queryFn: () => api.get<MapCollectionDto>("/lands/map"),
    retry: false, // the error state offers an explicit retry
  });
}
