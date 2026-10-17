"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import type { DecisionList, QueueList } from "@/features/officer/types";

export const TODAY_LIMIT = 50;
export const HISTORY_PAGE_SIZE = 10;

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403].includes(e.status)) && n < 2;

/** Documents waiting for a decision, oldest first. Also feeds the "next document" shortcut. */
export function useTodayQueue() {
  const { api } = useAuth();
  return useQuery<QueueList, ApiError>({
    queryKey: ["officer", "queue", "today"],
    queryFn: () => api.get<QueueList>(`/officer/queue?filter=pending&sort=created_at&order=asc&limit=${TODAY_LIMIT}`),
    retry: noRetry,
  });
}

export function useMyDecisions(page: number) {
  const { api } = useAuth();
  return useQuery<DecisionList, ApiError>({
    queryKey: ["officer", "my-decisions", page],
    queryFn: () => api.get<DecisionList>(`/officer/my-decisions?limit=${HISTORY_PAGE_SIZE}&offset=${(page - 1) * HISTORY_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
    retry: noRetry,
  });
}
