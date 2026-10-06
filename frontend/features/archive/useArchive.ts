"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { ARCHIVE_PAGE_SIZE, type ArchiveParams, type ArchiveSearch } from "./types";

export function archiveQuery(p: ArchiveParams): string {
  const s = new URLSearchParams();
  s.set("q", p.q.trim());
  if (p.survey) s.set("survey", p.survey);
  const district = p.district.trim();
  if (district) s.set("district", district);
  s.set("limit", String(ARCHIVE_PAGE_SIZE));
  s.set("offset", String((p.page - 1) * ARCHIVE_PAGE_SIZE));
  return s.toString();
}

export function useArchive(p: ArchiveParams) {
  const { api } = useAuth();
  return useQuery<ArchiveSearch, ApiError>({
    queryKey: ["archive", p],
    queryFn: () => api.get<ArchiveSearch>(`/archive/search?${archiveQuery(p)}`),
    enabled: p.q.trim().length > 0,
    placeholderData: keepPreviousData,
    retry: (n, e) => !(e instanceof ApiError && [401, 403, 422].includes(e.status)) && n < 2,
  });
}
