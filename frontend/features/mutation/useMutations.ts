"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { areaParams, NO_AREA, type Area } from "@/features/officers/AreaFilter";
import { PAGE_SIZE, type MutationDetailData, type MutationList } from "./types";

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2;

export function useMutationQueue(status: string, page: number, area: Area = NO_AREA) {
  const { api } = useAuth();
  const s = new URLSearchParams();
  if (status) s.set("status", status);
  areaParams(s, area);
  s.set("limit", String(PAGE_SIZE));
  s.set("offset", String((page - 1) * PAGE_SIZE));
  return useQuery<MutationList, ApiError>({
    queryKey: ["mutations", "list", status, page, area],
    queryFn: () => api.get<MutationList>(`/mutations?${s.toString()}`),
    placeholderData: keepPreviousData,
    retry: noRetry,
  });
}

export function useMutationDetail(id: string) {
  const { api } = useAuth();
  return useQuery<MutationDetailData, ApiError>({
    queryKey: ["mutations", "detail", id],
    queryFn: () => api.get<MutationDetailData>(`/mutations/${id}`),
    retry: noRetry,
  });
}

export function useMutationTransition(id: string) {
  const { api } = useAuth();
  const qc = useQueryClient();
  return useMutation<MutationDetailData, ApiError, { to: string; reason?: string }>({
    mutationFn: (v) => api.post<MutationDetailData>(`/mutations/${id}/transition`, v),
    onSuccess: (data) => {
      qc.setQueryData(["mutations", "detail", id], data);
      qc.invalidateQueries({ queryKey: ["mutations", "list"] });
    },
  });
}

function useDetailAction<V>(id: string, path: string) {
  const { api } = useAuth();
  const qc = useQueryClient();
  return useMutation<MutationDetailData, ApiError, V>({
    mutationFn: (v) => api.post<MutationDetailData>(`/mutations/${id}/${path}`, v),
    onSuccess: (data) => {
      qc.setQueryData(["mutations", "detail", id], data);
      qc.invalidateQueries({ queryKey: ["mutations", "list"] });
    },
  });
}

export const useMutationRecommend = (id: string) =>
  useDetailAction<{ decision: string; note: string }>(id, "recommend");
export const useMutationAppeal = (id: string) => useDetailAction<{ reason: string }>(id, "appeal");
