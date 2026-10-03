"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import type { PublicVerifyDto } from "./types";

/** No login: request is sent anonymously (no bearer, no silent refresh). */
export function usePublicVerify(landId: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["public", "verify", landId],
    retry: false,
    queryFn: () =>
      api.request<PublicVerifyDto>(`/public/verify/${encodeURIComponent(landId)}`, { anonymous: true }),
  });
}
