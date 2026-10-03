"use client";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { POLL_MS, TERMINAL_STATUSES, type DocumentOut } from "./types";

/** Polls GET /documents/{id} while the document is still UPLOADED/PROCESSING. */
export function useDocumentStatus(id: string | null, intervalMs: number = POLL_MS) {
  const { api } = useAuth();
  return useQuery<DocumentOut, ApiError>({
    queryKey: ["document", id],
    queryFn: () => api.get<DocumentOut>(`/documents/${id}`),
    enabled: !!id,
    retry: (n, e) => !(e instanceof ApiError && [403, 404].includes(e.status)) && n < 2,
    refetchInterval: (q) => {
      const s = q.state.data?.processing_status;
      return s && TERMINAL_STATUSES.includes(s) ? false : intervalMs;
    },
  });
}
