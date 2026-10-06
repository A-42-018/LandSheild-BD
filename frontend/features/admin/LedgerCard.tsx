"use client";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link2, ShieldCheck, ShieldAlert } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, ErrorState } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import type { LedgerVerify } from "./types";

const REASONS = ["SEQ_GAP", "PREV_HASH_MISMATCH", "ENTRY_HASH_MISMATCH", "RECORD_MODIFIED", "RECORD_MISSING"];

export default function LedgerCard() {
  const t = useTranslations("admin.ledger");
  const te = useTranslations("admin.console.errors");
  const { api } = useAuth();
  const verify = useMutation<LedgerVerify, ApiError>({
    mutationFn: () => api.get<LedgerVerify>("/admin/ledger/verify"),
  });
  const r = verify.data;
  return (
    <Card title={t("title")} icon={<Link2 aria-hidden="true" className="h-5 w-5" />} data-testid="ledger-card">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t("intro")}</p>
        <div>
          <Button onClick={() => verify.mutate()} loading={verify.isPending}>
            {t("verify")}
          </Button>
        </div>
        {verify.isError && (
          <ErrorState message={verify.error.status === 403 ? te("permission") : te("generic")} onRetry={() => verify.mutate()} />
        )}
        {r && r.status === "INTACT" && (
          <div role="status" data-testid="ledger-result" className="flex flex-col gap-1">
            <Badge tone="verified" icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}>{t("intact")}</Badge>
            <span className="text-sm">{t("entries", { count: r.entries })}</span>
          </div>
        )}
        {r && r.status === "BROKEN" && (
          <div role="alert" data-testid="ledger-result" className="flex flex-col gap-1">
            <Badge tone="critical" icon={<ShieldAlert aria-hidden="true" className="h-4 w-4" />}>
              {t("broken", { seq: r.broken_seq ?? 0 })}
            </Badge>
            <span className="text-sm">
              {r.reason && REASONS.includes(r.reason) ? t(`reasons.${r.reason}`) : t("reasons.UNKNOWN")}
            </span>
            {r.entity_type && <span className="text-xs text-ink-muted">{t("entity", { type: r.entity_type })}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
