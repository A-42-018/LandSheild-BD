"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import {
  ADMIN_PAGE_SIZE,
  type AdminDocument,
  type AdminLandRecord,
  type AdminUser,
  type ListParams,
  type Paged,
  type UserDraft,
} from "./types";

export type AdminKind = "users" | "land-records" | "documents";

export function adminQuery(kind: AdminKind, p: ListParams): string {
  const s = new URLSearchParams();
  const q = p.q.trim();
  if (q) s.set("q", q);
  if (p.filter) s.set(kind === "users" ? "role" : "status", p.filter);
  if (kind === "users" && p.active) s.set("is_active", p.active);
  s.set("sort", p.sort);
  s.set("order", p.order);
  s.set("limit", String(ADMIN_PAGE_SIZE));
  s.set("offset", String((p.page - 1) * ADMIN_PAGE_SIZE));
  return s.toString();
}

function useAdminList<T>(kind: AdminKind, p: ListParams) {
  const { api } = useAuth();
  return useQuery<Paged<T>, ApiError>({
    queryKey: ["admin", kind, p],
    queryFn: () => api.get<Paged<T>>(`/admin/${kind}?${adminQuery(kind, p)}`),
    placeholderData: keepPreviousData,
    retry: (n, e) => !(e instanceof ApiError && [401, 403, 422].includes(e.status)) && n < 2,
  });
}

export const useAdminUsers = (p: ListParams) => useAdminList<AdminUser>("users", p);
export const useAdminLandRecords = (p: ListParams) => useAdminList<AdminLandRecord>("land-records", p);
export const useAdminDocuments = (p: ListParams) => useAdminList<AdminDocument>("documents", p);

export type UserPatch = Partial<Pick<AdminUser, "name" | "role" | "is_active" | "preferred_language">>;

export function useUserMutations() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  const create = useMutation<AdminUser, ApiError, UserDraft>({
    mutationFn: (d) => api.post<AdminUser>("/admin/users", d),
    onSuccess: done,
  });
  const update = useMutation<AdminUser, ApiError, { id: string; patch: UserPatch }>({
    mutationFn: ({ id, patch }) => api.patch<AdminUser>(`/admin/users/${id}`, patch),
    onSuccess: done,
  });
  return { create, update };
}
