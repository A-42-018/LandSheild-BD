"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, ErrorState, LoadingState, Modal, Select, Table, type Column } from "@/components/ui";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import { ApiError } from "@/lib/api";
import { localDigits } from "@/lib/intl-locale";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDateTime } from "@/features/result/format";
import { FEEDBACK_STATUSES, type FeedbackItem, type FeedbackList, type FeedbackStatus } from "./types";

const AREA =
  "min-h-24 rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function FeedbackAdmin() {
  const t = useTranslations("feedback.admin");
  const tf = useTranslations("feedback");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { api } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<FeedbackItem | null>(null);
  const [next, setNext] = useState<FeedbackStatus>("IN_REVIEW");
  const [reply, setReply] = useState("");

  const q = useQuery<FeedbackList, ApiError>({
    queryKey: ["feedback", status],
    queryFn: () => api.get<FeedbackList>(`/feedback?limit=50${status ? `&status=${status}` : ""}`),
  });
  const save = useMutation<FeedbackItem, ApiError>({
    mutationFn: () => api.patch<FeedbackItem>(`/feedback/${open!.id}`, { status: next, response: reply }),
    onSuccess: () => {
      setOpen(null);
      qc.invalidateQueries({ queryKey: ["feedback"] });
    },
  });

  const edit = (r: FeedbackItem) => {
    setOpen(r);
    setNext(r.status === "RECEIVED" ? "IN_REVIEW" : r.status);
    setReply(r.response ?? "");
    save.reset();
  };
  const columns: Column<FeedbackItem>[] = [
    { key: "ref", header: t("cols.ref"), render: (r) => <span className="font-mono">{r.reference_no}</span> },
    { key: "kind", header: t("cols.kind"), render: (r) => tf(`kinds.${r.kind}`) },
    { key: "subject", header: t("cols.subject"), render: (r) => <span className="line-clamp-2">{r.subject}</span> },
    { key: "at", header: t("cols.received"), render: (r) => formatDateTime(r.created_at, locale, "—") },
    { key: "status", header: t("cols.status"), render: (r) => <Badge tone={r.status === "RESOLVED" || r.status === "CLOSED" ? "verified" : "review"}>{tf(`status.${r.status}`)}</Badge> },
    { key: "act", header: t("cols.action"), render: (r) => <Button size="sm" variant="secondary" onClick={() => edit(r)}>{t("handle")}</Button> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <OfficerPageHeader title={t("title")} purpose={t("purpose")} />
      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <p className="text-sm text-ink-muted" data-testid="feedback-summary">
            {t("summary", { open: localDigits(q.data.open, locale), helpful: localDigits(q.data.helpful, locale), notHelpful: localDigits(q.data.not_helpful, locale) })}
          </p>
          <Card title={t("title")} icon={<MessageSquare />} accent="primary">
            <div className="mb-3 max-w-xs">
              <Select
                label={t("filter")}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder={t("all")}
                options={FEEDBACK_STATUSES.map((s) => ({ value: s, label: tf(`status.${s}`) }))}
              />
            </div>
            <Table caption={t("title")} columns={columns} rows={q.data.items} rowKey={(r) => r.id} emptyText={t("empty")} />
          </Card>
        </>
      )}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.reference_no ?? ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>{t("cancel")}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t("save")}</Button>
          </>
        }
      >
        {open && (
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-ink">{open.subject}</p>
            <p className="whitespace-pre-wrap text-ink-muted">{open.message}</p>
            {open.contact_email && <p className="text-sm text-ink-muted">{t("contact")}: {open.contact_email}</p>}
            <Select label={t("cols.status")} value={next} onChange={(e) => setNext(e.target.value as FeedbackStatus)} options={FEEDBACK_STATUSES.map((s) => ({ value: s, label: tf(`status.${s}`) }))} />
            <div className="flex flex-col gap-1">
              <label htmlFor="fb-reply" className="text-sm font-medium text-ink">{t("reply")}</label>
              <textarea id="fb-reply" maxLength={1000} className={AREA} value={reply} onChange={(e) => setReply(e.target.value)} />
              <p className="text-xs text-ink-muted">{t("replyHint")}</p>
            </div>
            {save.isError && <p role="alert" className="text-sm text-critical">{te("generic")} {te("genericHint")}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
