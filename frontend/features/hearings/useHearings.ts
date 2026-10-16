"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { areaParams, NO_AREA, type Area } from "@/features/officers/AreaFilter";
import type { MutationDetailData, MutationQueueItem } from "@/features/mutation/types";

export interface HearingCalendarData {
  month: string;
  items: MutationQueueItem[];
  unscheduled: MutationQueueItem[];
}

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403].includes(e.status)) && n < 2;

export function useHearingCalendar(month: string, area: Area = NO_AREA) {
  const { api } = useAuth();
  const s = new URLSearchParams({ month });
  areaParams(s, area);
  return useQuery<HearingCalendarData, ApiError>({
    queryKey: ["mutations", "hearings", month, area],
    queryFn: () => api.get<HearingCalendarData>(`/mutations/hearings?${s.toString()}`),
    placeholderData: keepPreviousData,
    retry: noRetry,
  });
}

/** Set or move the hearing date of a case that is in HEARING. */
export function useScheduleHearing(id: string) {
  const { api } = useAuth();
  const qc = useQueryClient();
  return useMutation<MutationDetailData, ApiError, { hearing_at: string }>({
    mutationFn: (v) => api.post<MutationDetailData>(`/mutations/${id}/hearing`, v),
    onSuccess: (data) => {
      qc.setQueryData(["mutations", "detail", id], data);
      qc.invalidateQueries({ queryKey: ["mutations", "hearings"] });
      qc.invalidateQueries({ queryKey: ["officer", "stats"] });
    },
  });
}
