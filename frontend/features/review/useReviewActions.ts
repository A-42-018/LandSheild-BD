"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import type { DeedProfile, ExtractionOut, FieldError, RecordApiError, RecordOp } from "./types";

/** Field-level errors from a 422 (EXTRACTION_VALIDATION_FAILED / EXTRACTION_INVALID); [] otherwise. */
export function toFieldErrors(e: unknown): FieldError[] {
  if (!(e instanceof ApiError) || e.status !== 422 || !Array.isArray(e.details)) return [];
  return (e.details as unknown[]).filter(
    (d): d is FieldError =>
      !!d && typeof (d as FieldError).field === "string" && typeof (d as FieldError).code === "string",
  );
}

/** Path-level errors from a refused record edit (422 with details [{path, code}]); [] otherwise. */
export function toRecordErrors(e: unknown): RecordApiError[] {
  if (!(e instanceof ApiError) || e.status !== 422 || !Array.isArray(e.details)) return [];
  return (e.details as unknown[]).filter(
    (d): d is RecordApiError =>
      !!d && typeof (d as RecordApiError).path === "string" && typeof (d as RecordApiError).code === "string",
  );
}

export function useReviewActions(id: string) {
  const { api } = useAuth();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["document", id] }); // doc + extraction
  const refreshQueue = () => qc.invalidateQueries({ queryKey: ["officer"] }); // today's queue, counts, my decisions

  const save = useMutation<ExtractionOut, ApiError, { field: string; value: string | null }>({
    mutationFn: (v) => api.patch<ExtractionOut>(`/documents/${id}/extraction`, { fields: [v] }),
    onSuccess: (data) => qc.setQueryData(["document", id, "extraction"], data),
  });
  // H6b: LHDR record ops by JSON pointer; the answer carries the record and the derived 13 fields again
  const saveRecord = useMutation<ExtractionOut, ApiError, RecordOp[]>({
    mutationFn: (record) => api.patch<ExtractionOut>(`/documents/${id}/extraction`, { record }),
    onSuccess: (data) => qc.setQueryData(["document", id, "extraction"], data),
  });
  const approve = useMutation<unknown, ApiError, void>({
    mutationFn: () => api.post(`/documents/${id}/approve`),
    onSettled: () => Promise.all([refresh(), refreshQueue()]),
  });
  const reject = useMutation<unknown, ApiError, string>({
    mutationFn: (reason) => api.post(`/documents/${id}/reject`, { reason }),
    onSuccess: () => Promise.all([refresh(), refreshQueue()]),
  });
  // no profile: detect the deed type again; a profile forces that reading (modern <-> historical switch)
  const reprocess = useMutation<unknown, ApiError, DeedProfile | void>({
    mutationFn: (profile) =>
      profile ? api.post(`/documents/${id}/reprocess`, { profile }) : api.post(`/documents/${id}/reprocess`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["document", id, "extraction"] }); // edits are discarded server-side
      return refresh();
    },
  });
  const start = useMutation<unknown, ApiError, void>({
    mutationFn: () => api.post(`/documents/${id}/process`),
    onSuccess: refresh,
  });
  return { save, saveRecord, approve, reject, reprocess, start };
}

export function fieldErrorText(
  t: { has: (k: string) => boolean; (k: string, v?: Record<string, string | number>): string },
  e: FieldError,
): string {
  const key = `errors.${e.code}`;
  if (!t.has(key)) return t("errors.UNKNOWN");
  const p = e.params ?? {};
  const allowed = Array.isArray(p.allowed) ? (p.allowed as string[]).join(", ") : "";
  return t(key, { allowed, max: typeof p.max === "number" ? p.max : 0 });
}
