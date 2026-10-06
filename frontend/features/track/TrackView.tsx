"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, CircleDashed, Clock, Minus, Search, Route, XCircle, type LucideIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Input } from "@/components/ui";
import PageHeader from "@/components/PageHeader";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate } from "@/features/result/format";
import { MUTATION_NO, normaliseNo, type MutationStatusDto, type TrackStepState } from "./types";

/** State = icon + text + colour (roadmap 4.2 rule 4), theme tokens only. */
const STATE_STYLE: Record<TrackStepState, [string, LucideIcon]> = {
  done: ["border-verified bg-verified-soft text-verified", Check],
  current: ["border-primary bg-primary-soft text-primary", Clock],
  pending: ["border-line bg-surface-muted text-ink-muted", CircleDashed],
  skipped: ["border-line bg-surface-muted text-ink-muted", Minus],
};

export function Stepper({ data }: { data: MutationStatusDto }) {
  const t = useTranslations("track");
  const locale = useLocale();
  const rejected = data.status === "REJECTED";
  return (
    <ol className="flex flex-col gap-0" data-testid="track-steps" aria-label={t("stepsLabel")}>
      {data.steps.map((s, i) => {
        const last = i === data.steps.length - 1;
        const [cls, Icon] = rejected && s.step === "DECIDED" ? ["border-critical bg-critical-soft text-critical", XCircle] : STATE_STYLE[s.state];
        const label = s.step === "DECIDED" && s.state === "done" ? t(`outcome.${data.status}`) : t(`steps.${s.step}`);
        return (
          <li key={s.step} data-testid={`step-${s.step}`} data-state={s.state} className="flex gap-3" aria-current={s.state === "current" ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${cls}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              {!last && <span aria-hidden="true" className="my-1 w-0.5 flex-1 bg-line" />}
            </div>
            <div className={last ? "pb-0" : "pb-5"}>
              <p className="font-semibold text-ink">{label}</p>
              <p className="text-sm text-ink-muted">
                {t(`state.${s.state}`)}
                {s.at ? ` · ${formatDate(s.at, locale, "")}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackView() {
  const t = useTranslations("track");
  const tm = useTranslations("mutation");
  const locale = useLocale();
  const { api } = useAuth();
  const [no, setNo] = useState("");
  const [invalid, setInvalid] = useState(false);

  const m = useMutation<MutationStatusDto, ApiError, string>({
    mutationFn: (n) => api.request<MutationStatusDto>(`/public/mutation-status/${encodeURIComponent(n)}`, { anonymous: true }),
  });

  const apiErr = (() => {
    const e = m.error;
    if (!e) return null;
    if (e.status === 404 || e.code === "MUTATION_NOT_FOUND") return "notFound";
    if (e.status === 429) return "rateLimited";
    if (e.code === "NETWORK_ERROR") return "network";
    return "generic";
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = normaliseNo(no);
    const ok = MUTATION_NO.test(n);
    setInvalid(!ok);
    if (ok) m.mutate(n);
  };

  const d = m.data;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} purpose={t("purpose")} />
      <p role="note" className="rounded-md border border-line bg-surface-muted px-4 py-2 text-sm font-medium text-ink">
        {t("demoNote")}
      </p>
      <Card title={t("formTitle")} icon={<Route />} accent="primary">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Input
            label={t("number")}
            required
            autoComplete="off"
            placeholder={t("example")}
            hint={t("numberHint")}
            error={invalid ? t("errors.format") : undefined}
            value={no}
            onChange={(e) => setNo(e.target.value)}
          />
          {apiErr && (
            <p role="alert" className="text-sm text-critical">
              {t(`errors.${apiErr}`)}
            </p>
          )}
          <Button type="submit" loading={m.isPending} icon={<Search />} className="w-full sm:w-auto">
            {t("submit")}
          </Button>
        </form>
      </Card>
      <div aria-live="polite">
        {d && (
          <Card title={<span className="font-mono">{d.mutation_no}</span>} variant="record" data-testid="track-result">
            <dl className="mb-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">{t("status")}</dt>
                <dd className="font-medium text-ink" data-testid="track-status">
                  {tm(`tabs.${d.status}`)}
                  {d.fast_track ? ` · ${tm("fastTrack")}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t("office")}</dt>
                <dd className="font-medium text-ink">{d.office ?? t("officeUnknown")}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t("applied")}</dt>
                <dd className="font-medium text-ink">{formatDate(d.applied_at, locale, "-")}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t("pending")}</dt>
                <dd className="font-medium text-ink" data-testid="track-days">
                  {d.days_pending === null ? t("decided") : tm("days", { count: d.days_pending })}
                </dd>
              </div>
            </dl>
            <Stepper data={d} />
            <p className="mt-5 text-sm text-ink-muted">{t("privacyNote")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
