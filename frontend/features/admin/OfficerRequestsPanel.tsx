"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Check, UserCheck, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, ErrorState, LoadingState, Modal, Select, Table, type Column } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDateTime } from "@/features/result/format";
import { bi, officePath, type AdminOfficerRequest, type AdminOfficerRequestList, type RequestStatus } from "@/features/officers/types";
import { ADMIN_PAGE_SIZE } from "./types";

const TONE: Record<RequestStatus, "pending" | "verified" | "critical"> = { PENDING: "pending", APPROVED: "verified", REJECTED: "critical" };

export default function OfficerRequestsPanel() {
  const t = useTranslations("admin.console.officers");
  const tc = useTranslations("admin.console");
  const locale = useLocale();
  const { api } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<RequestStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<AdminOfficerRequest | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  const list = useQuery<AdminOfficerRequestList, ApiError>({
    queryKey: ["admin", "officer-requests", status, page],
    queryFn: () => api.get(`/admin/officer-requests?${new URLSearchParams({ ...(status ? { status } : {}), limit: String(ADMIN_PAGE_SIZE), offset: String((page - 1) * ADMIN_PAGE_SIZE) })}`),
    placeholderData: keepPreviousData,
  });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "officer-requests"] });
  const approve = useMutation<unknown, ApiError, string>({ mutationFn: (id) => api.post(`/admin/officer-requests/${id}/approve`), onSuccess: done, onError: () => setError(true) });
  const reject = useMutation<unknown, ApiError, { id: string; reason: string }>({
    mutationFn: ({ id, reason: r }) => api.post(`/admin/officer-requests/${id}/reject`, { reason: r }),
    onSuccess: () => { setRejecting(null); done(); },
    onError: () => setError(true),
  });

  const columns: Column<AdminOfficerRequest>[] = [
    { key: "name", header: t("cols.applicant"), render: (r) => (<><span className="font-medium">{r.name}</span><br /><span className="text-xs text-ink-muted">{r.email}</span></>) },
    { key: "office", header: t("cols.office"), render: (r) => (<><span>{bi(r.office.name_en, r.office.name_bn)}</span><br /><span className="text-xs text-ink-muted">{officePath(r.office)}</span></>) },
    { key: "details", header: t("cols.details"), render: (r) => (<span className="text-sm">{r.designation}<br />{t("empId")}: {r.employee_id}<br />{r.phone}{r.proof_note && (<><br /><span className="text-xs text-ink-muted">{r.proof_note}</span></>)}</span>) },
    { key: "created_at", header: t("cols.requested"), className: "whitespace-nowrap", render: (r) => formatDateTime(r.created_at, locale, "—") },
    { key: "status", header: t("cols.status"), render: (r) => (<><Badge tone={TONE[r.status]}>{t(`status.${r.status}`)}</Badge>{r.rejection_reason && <p className="mt-1 text-xs text-ink-muted">{r.rejection_reason}</p>}</>) },
    {
      key: "actions",
      header: t("cols.actions"),
      render: (r) => r.status !== "PENDING" ? null : (
        <div className="flex gap-2">
          <Button size="sm" icon={<Check />} loading={approve.isPending && approve.variables === r.id} onClick={() => { setError(false); approve.mutate(r.id); }} aria-label={t("approveFor", { name: r.name })}>{t("approve")}</Button>
          <Button size="sm" variant="secondary" icon={<X />} onClick={() => { setError(false); setReason(""); setRejecting(r); }} aria-label={t("rejectFor", { name: r.name })}>{t("reject")}</Button>
        </div>
      ),
    },
  ];

  return (
    <Card title={t("title")} icon={<UserCheck />} accent="primary">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-ink-muted">{t("hint")}{list.data ? ` ${t("pendingCount", { n: list.data.pending })}` : ""}</p>
          <Select label={tc("status")} value={status} placeholder={tc("all")} onChange={(e) => { setStatus(e.target.value as RequestStatus | ""); setPage(1); }}
            options={(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))} />
        </div>
        {error && !rejecting && <p role="alert" className="rounded-lg border border-critical/30 bg-critical-soft p-3 text-sm text-critical">{t("error")}</p>}
        {list.isLoading ? <LoadingState /> : list.isError || !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <div aria-busy={list.isFetching} data-testid="officer-requests-table">
            <Table caption={t("title")} columns={columns} rows={list.data.items} rowKey={(r) => r.id} page={page} pageSize={ADMIN_PAGE_SIZE} total={list.data.total} onPageChange={setPage} emptyText={t("empty")} />
          </div>
        )}
      </div>
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={t("rejectTitle", { name: rejecting?.name ?? "" })}
        footer={<>
          <Button variant="secondary" onClick={() => setRejecting(null)}>{tc("cancel")}</Button>
          <Button type="submit" form="officer-reject-form" loading={reject.isPending} disabled={reason.trim().length < 3}>{t("reject")}</Button>
        </>}
      >
        <form id="officer-reject-form" className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (rejecting && reason.trim().length >= 3) reject.mutate({ id: rejecting.id, reason: reason.trim() }); }}>
          <label htmlFor="reject-reason" className="text-sm font-medium">{t("reason")}</label>
          <textarea id="reject-reason" rows={3} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <p className="text-xs text-ink-muted">{t("reasonHint")}</p>
          {error && <p role="alert" className="text-sm text-critical">{t("error")}</p>}
        </form>
      </Modal>
    </Card>
  );
}
