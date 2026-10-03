"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import type { LandGraphDto } from "./types";

export function useGraph(landId?: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["land", landId, "graph"],
    enabled: Boolean(landId),
    retry: false,
    queryFn: () => api.get<LandGraphDto>(`/lands/${encodeURIComponent(landId ?? "")}/graph`),
  });
}
