"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import {
  DEFAULT_PARAMS, LIBRARY_PAGE_SIZE, LIBRARY_SORTS, LIBRARY_TABS, RECENT_SIZE,
  type LibraryList, type LibraryParams,
} from "./types";

const noRetry = (n: number, e: unknown) => !(e instanceof ApiError && [401, 403, 422].includes(e.status)) && n < 2;

const STRING_KEYS = ["status", "type", "division", "district", "upazila", "date_from", "date_to", "q"] as const;

/** API query string for GET /documents. */
export function libraryQuery(p: LibraryParams, limit = LIBRARY_PAGE_SIZE): string {
  const s = new URLSearchParams();
  s.set("tab", p.tab);
  for (const k of STRING_KEYS) {
    const v = p[k].trim();
    if (v) s.set(k, v);
  }
  if (p.profile) s.set("profile", p.profile);
  s.set("sort", p.sort);
  s.set("order", p.order);
  s.set("limit", String(limit));
  s.set("offset", String((p.page - 1) * limit));
  return s.toString();
}

/** URL search string (no limit/offset, defaults left out) so a filtered list can be shared and reloaded. */
export function paramsToUrl(p: LibraryParams): string {
  const s = new URLSearchParams();
  if (p.tab !== DEFAULT_PARAMS.tab) s.set("tab", p.tab);
  for (const k of STRING_KEYS) if (p[k].trim()) s.set(k, p[k].trim());
  if (p.profile) s.set("profile", p.profile);
  if (p.sort !== DEFAULT_PARAMS.sort) s.set("sort", p.sort);
  if (p.order !== DEFAULT_PARAMS.order) s.set("order", p.order);
  if (p.page > 1) s.set("page", String(p.page));
  return s.toString();
}

/** Read the page state from the URL; anything unknown falls back to the default. */
export function paramsFromUrl(sp: { get(name: string): string | null }): LibraryParams {
  const tab = sp.get("tab");
  const sort = sp.get("sort");
  const profile = sp.get("profile");
  const page = Number(sp.get("page"));
  const out: LibraryParams = {
    ...DEFAULT_PARAMS,
    tab: LIBRARY_TABS.find((x) => x === tab) ?? DEFAULT_PARAMS.tab,
    sort: LIBRARY_SORTS.find((x) => x === sort) ?? DEFAULT_PARAMS.sort,
    order: sp.get("order") === "asc" ? "asc" : "desc",
    profile: profile === "modern" || profile === "historical" ? profile : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
  for (const k of STRING_KEYS) out[k] = sp.get(k) ?? "";
  return out;
}

export function useLibrary(p: LibraryParams, limit = LIBRARY_PAGE_SIZE) {
  const { api } = useAuth();
  return useQuery<LibraryList, ApiError>({
    queryKey: ["library", p, limit],
    queryFn: () => api.get<LibraryList>(`/documents?${libraryQuery(p, limit)}`),
    placeholderData: keepPreviousData,
    retry: noRetry,
  });
}

/** The officer home card: my last uploads. */
export function useRecentUploads() {
  return useLibrary({ ...DEFAULT_PARAMS, tab: "mine" }, RECENT_SIZE);
}
