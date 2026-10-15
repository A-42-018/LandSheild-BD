"use client";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, FileText, HelpCircle, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { DeedArt } from "@/features/landing/Illustrations";
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
const BANNER: Record<DocVerifyState, string> = {
  AUTHENTIC: "border-l-verified bg-verified-soft/60",
  ALTERED: "border-l-critical bg-critical-soft/60",
  NOT_FOUND: "border-l-pending bg-pending-soft/60",
  UNREADABLE: "border-l-review bg-review-soft/60",
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
      <Card title={t("title")} icon={<FileSearch />}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) m.mutate(file);
          }}
        >
          <p className="text-ink-muted">{t("intro")}</p>
          <label
            className="glass-card group flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-primary/40 p-6 text-center transition-colors hover:border-primary focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25"
          >
            <span aria-hidden="true" className="[&>svg]:h-20 [&>svg]:w-auto"><DeedArt /></span>
            <span className="text-sm font-semibold text-ink">{t("file")}</span>
            <input
              ref={input}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              data-testid="doc-file"
              className="w-full max-w-xs text-sm text-ink file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:font-medium file:text-primary-fg"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                m.reset();
              }}
            />
            <span className="text-xs font-normal text-ink-muted">{t("fileHint")}</span>
          </label>
          {file && (
            <p data-testid="doc-file-chip" className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-sm text-ink">
              <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{file.name}</span>
            </p>
          )}
          <Button type="submit" size="lg" fullWidthOnMobile disabled={!file || m.isPending}>
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
          <div className={`flex items-center gap-3 rounded-xl border-l-[3px] p-4 ${BANNER[d.state]}`}>
            <Icon aria-hidden="true" className={`h-9 w-9 shrink-0 ${TONE[d.state]}`} />
            <p role="status" className="font-display text-xl font-bold text-ink">
              <span data-testid="doc-state">{t(`state.${d.state}`)}</span>
            </p>
          </div>
          <p className="mt-3 text-sm text-ink-muted">{t(`detail.${d.state}`)}</p>
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
