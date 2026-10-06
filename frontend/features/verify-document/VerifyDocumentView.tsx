"use client";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, HelpCircle, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import type { DocVerifyDto, DocVerifyState } from "./types";

const ICON: Record<DocVerifyState, LucideIcon> = {
  AUTHENTIC: CheckCircle2,
  ALTERED: XCircle,
  NOT_FOUND: HelpCircle,
  UNREADABLE: AlertTriangle,
};
const TONE: Record<DocVerifyState, string> = {
  AUTHENTIC: "text-verified",
  ALTERED: "text-critical",
  NOT_FOUND: "text-ink-muted",
  UNREADABLE: "text-review",
};
const FIELDS = ["khatian_no", "dag_no", "land_area", "area_unit", "deed_date", "seller", "buyer"];

export default function VerifyDocumentView() {
  const t = useTranslations("verifyDoc");
  const { api } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const m = useMutation<DocVerifyDto, ApiError, File>({
    mutationFn: (f) => {
      const form = new FormData();
      form.append("file", f);
      return api.upload<DocVerifyDto>("/public/verify-document", form);
    },
  });

  const errKey = (() => {
    const e = m.error;
    if (!e) return null;
    if (e.status === 429) return "rate";
    if ([400, 413, 415].includes(e.status)) return "file";
    if (e.code === "NETWORK_ERROR") return "network";
    return "generic";
  })();
  const d = m.data;
  const Icon = d ? ICON[d.state] : null;

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("title")} icon={<FileSearch />} accent="primary">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) m.mutate(file);
          }}
        >
          <p className="text-ink-muted">{t("intro")}</p>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t("file")}
            <input
              ref={input}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              data-testid="doc-file"
              className="min-h-11 rounded-lg border border-line bg-surface p-2 text-ink"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                m.reset();
              }}
            />
            <span className="text-xs font-normal text-ink-muted">{t("fileHint")}</span>
          </label>
          <Button type="submit" disabled={!file || m.isPending}>
            {m.isPending ? t("checking") : t("submit")}
          </Button>
        </form>
      </Card>

      {errKey && (
        <p role="alert" className="text-critical" data-testid="doc-error">
          {t(`errors.${errKey}`)}
        </p>
      )}

      {d && Icon && (
        <Card title={t("resultTitle")} accent={d.state === "AUTHENTIC" ? "verified" : "critical"} data-testid="doc-verify-result" data-state={d.state}>
          <p role="status" className="flex items-center gap-2 font-semibold text-ink">
            <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${TONE[d.state]}`} />
            <span data-testid="doc-state">{t(`state.${d.state}`)}</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">{t(`detail.${d.state}`)}</p>
          {d.state === "ALTERED" && d.differing.length > 0 && (
            <ul className="mt-3 list-disc ps-5 text-sm text-ink" data-testid="doc-differing">
              {d.differing.map((f) => (
                <li key={f}>{FIELDS.includes(f) ? t(`fields.${f}`) : f}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink-muted">{t("disclaimer")}</p>
        </Card>
      )}
    </div>
  );
}
