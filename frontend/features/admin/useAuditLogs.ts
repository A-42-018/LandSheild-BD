"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { AUDIT_PAGE_SIZE, type AuditLogList, type AuditParams } from "./types";

export function auditQuery(p: AuditParams): string {
  const s = new URLSearchParams();
  const actor = p.actor.trim();
  if (actor) s.set("actor", actor);
  if (p.action) s.set("action", p.action);
  if (p.entity) s.set("entity_type", p.entity);
  if (p.from) s.set("date_from", p.from);
  if (p.to) s.set("date_to", p.to);
  s.set("limit", String(AUDIT_PAGE_SIZE));
  s.set("offset", String((p.page - 1) * AUDIT_PAGE_SIZE));
  return s.toString();
}

export function useAuditLogs(p: AuditParams) {
  const { api } = useAuth();
  return useQuery<AuditLogList, ApiError>({
    queryKey: ["admin", "audit-logs", p],
    queryFn: () => api.get<AuditLogList>(`/admin/audit-logs?${auditQuery(p)}`),
    placeholderData: keepPreviousData,
    retry: (n, e) => !(e instanceof ApiError && [401, 403, 422].includes(e.status)) && n < 2,
  });
}
