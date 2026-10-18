"use client";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import type { LandDocuments, RecordHistory, RecordVersion, RecordVersionList } from "./types";

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2;

/** All digital versions of a document (no record content). */
export function useRecordVersions(id: string) {
  const { api } = useAuth();
  return useQuery<RecordVersionList, ApiError>({
    queryKey: ["document", id, "records"],
    queryFn: () => api.get<RecordVersionList>(`/documents/${id}/records`),
    retry: noRetry,
  });
}

/** One version with its record. */
export function useRecordVersion(id: string, version: number | null) {
  const { api } = useAuth();
  return useQuery<RecordVersion, ApiError>({
    queryKey: ["document", id, "records", version],
    queryFn: () => api.get<RecordVersion>(`/documents/${id}/records/${version}`),
    enabled: version !== null,
    retry: noRetry,
  });
}

/** Who changed what and when, per version (read from the audit log). */
export function useRecordHistory(id: string) {
  const { api } = useAuth();
  return useQuery<RecordHistory, ApiError>({
    queryKey: ["document", id, "records", "history"],
    queryFn: () => api.get<RecordHistory>(`/documents/${id}/records/history`),
    retry: noRetry,
  });
}

/** Every document of a land, deed date order (staff only: citizens get 403, so keep `enabled` off for them). */
export function useLandDocuments(landId: string | undefined, enabled: boolean) {
  const { api } = useAuth();
  return useQuery<LandDocuments, ApiError>({
    queryKey: ["land", landId, "documents"],
    queryFn: () => api.get<LandDocuments>(`/lands/${encodeURIComponent(landId ?? "")}/documents`),
    enabled: enabled && !!landId,
    retry: noRetry,
  });
}
