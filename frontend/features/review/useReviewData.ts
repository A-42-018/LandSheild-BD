"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { useDocumentStatus } from "@/features/upload/useDocumentStatus";
import { EXTRACTION_READY, type ExtractionOut } from "./types";

export function useExtraction(id: string, status: string | undefined) {
  const { api } = useAuth();
  return useQuery<ExtractionOut, ApiError>({
    queryKey: ["document", id, "extraction"],
    queryFn: () => api.get<ExtractionOut>(`/documents/${id}/extraction`),
    enabled: !!status && EXTRACTION_READY.includes(status),
    retry: (n, e) => !(e instanceof ApiError && [403, 404, 409].includes(e.status)) && n < 2,
  });
}

/** Original file as an object URL (auth header cannot be sent by <img>/<iframe>). Revoked on unmount. */
export function useDocumentFile(id: string) {
  const { api } = useAuth();
  const [state, setState] = useState<{ url: string | null; error: boolean; loading: boolean }>({
    url: null,
    error: false,
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setState({ url: null, error: false, loading: true });
    api
      .blob(`/documents/${id}/file`)
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setState({ url: objectUrl, error: false, loading: false });
      })
      .catch(() => alive && setState({ url: null, error: true, loading: false }));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, id, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

export { useDocumentStatus };
