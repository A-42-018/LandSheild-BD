"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import type { MeSummary, NotificationList, ReportList, SearchList, WatchItem, WatchList } from "./types";

/** Every `/me` query lives under this key, so one invalidation refreshes the whole citizen area. */
export const ME = ["me"] as const;

function useMe<T>(key: string[], path: string, enabled = true) {
  const { api, status } = useAuth();
  return useQuery({ queryKey: [...ME, ...key], enabled: enabled && status === "authenticated", queryFn: () => api.get<T>(path) });
}

export const useSummary = () => useMe<MeSummary>(["summary"], "/me/summary");
export const useSearches = () => useMe<SearchList>(["searches"], "/me/searches?limit=100");
export const useReports = () => useMe<ReportList>(["reports"], "/me/reports?limit=100");
export const useNotifications = (unreadOnly = false) =>
  useMe<NotificationList>(["notifications", unreadOnly ? "unread" : "all"], `/me/notifications?limit=100${unreadOnly ? "&unread_only=true" : ""}`);
/** `enabled=false` for staff: the watch button only exists for citizens. */
export const useWatchlist = (enabled = true) => useMe<WatchList>(["watchlist"], "/me/watchlist", enabled);

function useMeMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ME }) });
}

export function useWatchToggle() {
  const { api } = useAuth();
  return useMeMutation(({ landId, watch }: { landId: string; watch: boolean }) =>
    watch
      ? api.post<WatchItem>("/me/watchlist", { land_id: landId }).then(() => watch)
      : api.del(`/me/watchlist/${encodeURIComponent(landId)}`).then(() => watch),
  );
}

export function useClearSearches() {
  const { api } = useAuth();
  return useMeMutation(() => api.del("/me/searches"));
}

export function useMarkRead() {
  const { api } = useAuth();
  return useMeMutation((ids?: string[]) => api.post<{ unread: number }>("/me/notifications/read", ids ? { ids } : {}));
}
