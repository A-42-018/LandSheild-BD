"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import {
  PAGE_SIZE, SIDE_LIST_SIZE,
  type ActivityList, type AlertItem, type AlertList, type AlertStatus,
  type OfficerStats, type QueueList, type QueueParams,
} from "./types";

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403].includes(e.status)) && n < 2;

export function useOfficerStats() {
  const { api } = useAuth();
  return useQuery<OfficerStats, ApiError>({
    queryKey: ["officer", "stats"],
    queryFn: () => api.get<OfficerStats>("/officer/stats"),
    retry: noRetry,
  });
}

export function queueQuery(p: QueueParams): string {
  const s = new URLSearchParams();
  if (p.filter) s.set("filter", p.filter);
  const q = p.q.trim();
  if (q) s.set("q", q);
  s.set("sort", p.sort);
  s.set("order", p.order);
  s.set("limit", String(PAGE_SIZE));
  s.set("offset", String((p.page - 1) * PAGE_SIZE));
  return s.toString();
}

export function useOfficerQueue(p: QueueParams) {
  const { api } = useAuth();
  return useQuery<QueueList, ApiError>({
    queryKey: ["officer", "queue", p],
    queryFn: () => api.get<QueueList>(`/officer/queue?${queueQuery(p)}`),
    placeholderData: keepPreviousData,
    retry: noRetry,
  });
}


export function useAlertTotals() {
  const { api } = useAuth();
  return useQuery<{ HIGH: number; MEDIUM: number }, ApiError>({
    queryKey: ["officer", "alert-totals"],
    queryFn: async () => {
      const [h, m] = await Promise.all([
        api.get<AlertList>("/risk-alerts?severity=HIGH&limit=1"),
        api.get<AlertList>("/risk-alerts?severity=MEDIUM&limit=1"),
      ]);
      return { HIGH: h.total, MEDIUM: m.total };
    },
    retry: noRetry,
  });
}

export function useAlerts() {
  const { api } = useAuth();
  return useQuery<AlertList, ApiError>({
    queryKey: ["officer", "alerts"],
    queryFn: () => api.get<AlertList>(`/risk-alerts?limit=${SIDE_LIST_SIZE}`),
    retry: noRetry,
  });
}

export function useAlertStatus() {
  const { api } = useAuth();
  const qc = useQueryClient();
  return useMutation<AlertItem, ApiError, { id: string; status: AlertStatus }>({
    mutationFn: ({ id, status }) => api.patch<AlertItem>(`/risk-alerts/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["officer", "alerts"] });
      qc.invalidateQueries({ queryKey: ["officer", "alert-totals"] });
      qc.invalidateQueries({ queryKey: ["officer", "activity"] });
    },
  });
}

export function useActivity() {
  const { api } = useAuth();
  return useQuery<ActivityList, ApiError>({
    queryKey: ["officer", "activity"],
    queryFn: () => api.get<ActivityList>(`/officer/activity?limit=${SIDE_LIST_SIZE}`),
    retry: noRetry,
  });
}
