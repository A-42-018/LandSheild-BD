"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import type { PublicRecordDto, PublicSealDto, PublicSignatureDto, PublicVerifyDto } from "./types";

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

export function usePublicSeal(landId: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["public", "seal", landId],
    retry: false,
    queryFn: () => api.request<PublicSealDto>(`/public/seal/${encodeURIComponent(landId)}`, { anonymous: true }),
  });
}

export function usePublicSignature(deedId: string | null, hash12: string | null) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["public", "signature", deedId, hash12],
    enabled: Boolean(deedId && hash12),
    retry: false,
    queryFn: () =>
      api.request<PublicSignatureDto>(
        `/public/signature?d=${encodeURIComponent(deedId ?? "")}&h=${encodeURIComponent(hash12 ?? "")}`,
        { anonymous: true },
      ),
  });
}

export function usePublicRecord(recordId: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ["public", "record", recordId],
    retry: false,
    queryFn: () =>
      api.request<PublicRecordDto>(`/public/records/${encodeURIComponent(recordId)}`, { anonymous: true }),
  });
}
