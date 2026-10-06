"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { PAGE_SIZE, type MutationDetailData, type MutationList } from "./types";

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2;

export function useMutationQueue(status: string, page: number) {
  const { api } = useAuth();
  const s = new URLSearchParams();
  if (status) s.set("status", status);
  s.set("limit", String(PAGE_SIZE));
  s.set("offset", String((page - 1) * PAGE_SIZE));
  return useQuery<MutationList, ApiError>({
    queryKey: ["mutations", "list", status, page],
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
