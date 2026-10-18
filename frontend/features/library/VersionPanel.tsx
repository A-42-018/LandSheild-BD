"use client";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, ShieldAlert, HelpCircle } from "lucide-react";
import { Badge, Card, Select } from "@/components/ui";
import { formatDateTime } from "@/features/result/format";
import type { RecordVersion, SignatureStatus } from "./types";

/** The version shown first: the newest approved one, else the newest. */
export function defaultVersion(items: RecordVersion[]): number | null {
  if (items.length === 0) return null;
  const approved = items.filter((i) => i.status === "APPROVED").map((i) => i.version);
  return Math.max(...(approved.length ? approved : items.map((i) => i.version)));
}

export function SignatureBadge({ status }: { status: SignatureStatus }) {
  const t = useTranslations("library.doc.signature");
  if (status === "VALID") return <Badge tone="verified" icon={<CheckCircle2 />} data-testid="signature-status" data-status={status}>{t("VALID")}</Badge>;
  if (status === "INVALID") return <Badge tone="critical" icon={<ShieldAlert />} data-testid="signature-status" data-status={status}>{t("INVALID")}</Badge>;
  return <Badge tone="pending" icon={<HelpCircle />} data-testid="signature-status" data-status={status}>{t("UNSIGNED")}</Badge>;
}

const TONE = { MACHINE: "pending", DRAFT: "review", APPROVED: "verified", SUPERSEDED: "pending" } as const;

function Hash({ label, value, testId }: { label: string; value: string | null; testId: string }) {
  const t = useTranslations("library.doc");
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd data-testid={testId} className="break-all font-mono text-xs text-ink">{value ?? t("none")}</dd>
    </div>
  );
}

/** Version picker, who and when, the SHA-256 of the original and of the record, and the signature state. */
export default function VersionPanel({
  items,
  fileHash,
  selected,
  onSelect,
  version,
}: {
  items: RecordVersion[];
  fileHash: string;
  selected: number;
  onSelect: (v: number) => void;
  /** the selected version (may still be loading: then only the picker shows) */
  version: RecordVersion | undefined;
}) {
  const t = useTranslations("library.doc");
  const locale = useLocale();
  const ordered = [...items].sort((a, b) => a.version - b.version);
  return (
    <Card title={t("versionsTitle")} data-testid="version-panel">
      <div className="flex flex-col gap-4">
        <Select
          label={t("versionLabel")}
          value={String(selected)}
          onChange={(e) => onSelect(Number(e.target.value))}
          options={ordered.map((i) => ({ value: String(i.version), label: t("versionOption", { version: i.version, status: t(`recordStatus.${i.status}`) }) }))}
        />
        {version && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="version-meta">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("status")}</dt>
              <dd><Badge tone={TONE[version.status]} data-testid="version-status">{t(`recordStatus.${version.status}`)}</Badge></dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("signature.label")}</dt>
              <dd><SignatureBadge status={version.signature_status} /></dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("createdBy")}</dt>
              <dd className="text-sm text-ink">
                {version.created_by ?? t("byJob")} · {formatDateTime(version.created_at, locale, "—")}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("approvedBy")}</dt>
              <dd className="text-sm text-ink">
                {version.approved_by ? `${version.approved_by} · ${formatDateTime(version.approved_at, locale, "—")}` : t("notApproved")}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("schema")}</dt>
              <dd className="font-mono text-xs text-ink">{version.record_schema}</dd>
            </div>
          </dl>
        )}
        <dl className="flex flex-col gap-3 border-t border-line pt-3">
          <Hash label={t("fileHash")} value={version?.file_hash ?? fileHash} testId="file-hash" />
          {version && <Hash label={t("recordHash")} value={version.record_hash} testId="record-hash" />}
        </dl>
      </div>
    </Card>
  );
}
