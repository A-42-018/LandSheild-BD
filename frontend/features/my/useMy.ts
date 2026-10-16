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
/** Header bell (U3.7): the smallest notifications page carries the `unread` total. Refreshed every minute and on tab focus, since
 *  the header outlives page navigations; any `/me` mutation (e.g. mark read) invalidates it too. */
export function useUnreadCount() {
  const { api, status } = useAuth();
  return useQuery({
    queryKey: [...ME, "notifications", "count"],
    enabled: status === "authenticated",
    queryFn: () => api.get<NotificationList>("/me/notifications?unread_only=true&limit=1").then((r) => r.unread),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
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
