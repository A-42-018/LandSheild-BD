"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, CircleDashed, Clock, Minus, Search, Route, XCircle, type LucideIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Input } from "@/components/ui";
import ServiceLayout from "@/components/ServiceLayout";
import { RouteArt } from "@/features/landing/Illustrations";
import { ApiError } from "@/lib/api";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate } from "@/features/result/format";
import { FEEDBACK_REF, type PublicFeedbackStatus } from "@/features/feedback/types";
import { statusSentence } from "./sentence";
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
    <ol className="flex flex-col gap-0 sm:flex-row sm:gap-2" data-testid="track-steps" aria-label={t("stepsLabel")}>
      {data.steps.map((s, i) => {
        const last = i === data.steps.length - 1;
        const [cls, Icon] = rejected && s.step === "DECIDED" ? ["border-critical bg-critical-soft text-critical", XCircle] : STATE_STYLE[s.state];
        const label = s.step === "DECIDED" && s.state === "done" ? t(`outcome.${data.status}`) : t(`steps.${s.step}`);
        return (
          <li key={s.step} data-testid={`step-${s.step}`} data-state={s.state} className="flex gap-3 sm:flex-1 sm:flex-col sm:gap-2" aria-current={s.state === "current" ? "step" : undefined}>
            <div className="flex flex-col items-center sm:flex-row">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${cls}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              {!last && <span aria-hidden="true" className="my-1 w-0 flex-1 border-l-2 border-dashed border-primary/30 sm:mx-1 sm:my-0 sm:h-0 sm:w-auto sm:border-l-0 sm:border-t-2" />}
            </div>
            <div className={last ? "pb-0" : "pb-5 sm:pb-0"}>
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

/** SMS-style status in plain words: the number, then one short sentence each for the stage, the days and the office. */
export function StatusLine({ data }: { data: MutationStatusDto }) {
  const t = useTranslations("track");
  const x = statusSentence(data);
  return (
    <div className="mb-5 rounded-xl border border-primary/30 bg-primary-soft p-4" data-testid="track-sentence" role="group" aria-label={t("sentence.label")}>
      <p className="text-lg font-semibold leading-relaxed text-ink">
        <span className="font-mono">{data.mutation_no}</span>
        {": "}
        {t(`sentence.${x.status}`)}
      </p>
      {(x.days !== null || x.office) && (
        <p className="mt-1 text-ink-muted">
          {x.days !== null && t("sentence.days", { count: x.days })}
          {x.days !== null && x.office ? " " : ""}
          {x.office && t("sentence.office", { office: x.office })}
        </p>
      )}
    </div>
  );
}

export default function TrackView() {
  const t = useTranslations("track");
  const tm = useTranslations("mutation");
  const tf = useTranslations("feedback");
  const locale = useLocale();
  const { api } = useAuth();
  const [no, setNo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const focus = useFocusFirstInvalid();

  const m = useMutation<MutationStatusDto, ApiError, string>({
    mutationFn: (n) => api.request<MutationStatusDto>(`/public/mutation-status/${encodeURIComponent(n)}`, { anonymous: true }),
  });

  const f = useMutation<PublicFeedbackStatus, ApiError, string>({
    mutationFn: (n) => api.request<PublicFeedbackStatus>(`/public/feedback/${encodeURIComponent(n)}`, { anonymous: true }),
  });

  const apiErr = (() => {
    const e = m.error ?? f.error;
    if (!e) return null;
    if (e.status === 404 || e.code === "MUTATION_NOT_FOUND" || e.code === "FEEDBACK_NOT_FOUND") return "notFound";
    if (e.status === 429) return "rateLimited";
    if (e.code === "NETWORK_ERROR") return "network";
    return "generic";
  })();

  const lookUp = (raw: string) => {
    const n = normaliseNo(raw);
    const isFeedback = FEEDBACK_REF.test(n);
    const ok = isFeedback || MUTATION_NO.test(n);
    setInvalid(!ok);
    if (!ok) return focus.request();
    m.reset();
    f.reset();
    if (isFeedback) f.mutate(n);
    else m.mutate(n);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    lookUp(no);
  };
  // U1.3: the home-page search card sends `?no=`; fill the box and look it up straight away.
  // Strict Mode (dev) unmounts and remounts the effect: the first call's result is dropped with its observer, so the
  // cleanup re-arms the guard and the second run asks again. In production it runs once.
  const arrived = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("no");
    if (!q || arrived.current) return;
    arrived.current = true;
    setNo(q);
    lookUp(q);
    return () => {
      arrived.current = false;
    };
  }, []);

  const d = m.data;
  const fb = f.data;
  return (
    <ServiceLayout service="track" title={t("title")} purpose={t("purpose")} art={<RouteArt />}>
      <p role="note" className="glass-card px-4 py-2 text-sm font-medium text-ink">
        {t("demoNote")}
      </p>
      <Card title={t("formTitle")} icon={<Route />}>
        <form ref={focus.ref} onSubmit={submit} noValidate className="flex flex-col gap-4">
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
          <Button type="submit" size="lg" fullWidthOnMobile loading={m.isPending || f.isPending} icon={<Search />}>
            {t("submit")}
          </Button>
        </form>
      </Card>
      <div aria-live="polite">
        {fb && (
          <Card title={<span className="font-mono">{fb.reference_no}</span>} variant="record" data-testid="feedback-status">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">{t("kind")}</dt>
                <dd className="font-medium text-ink">{tf(`kinds.${fb.kind}`)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t("status")}</dt>
                <dd className="font-medium text-ink" data-testid="feedback-state">{tf(`status.${fb.status}`)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t("applied")}</dt>
                <dd className="font-medium text-ink">{formatDate(fb.created_at, locale, "-")}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t("lastUpdate")}</dt>
                <dd className="font-medium text-ink">{formatDate(fb.updated_at, locale, "-")}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-muted">{t("response")}</dt>
                <dd className="font-medium text-ink">{fb.response ?? t("noResponse")}</dd>
              </div>
            </dl>
            <p className="mt-5 text-sm text-ink-muted">{t("feedbackPrivacy")}</p>
          </Card>
        )}
        {d && (
          <Card title={<span className="font-mono">{d.mutation_no}</span>} variant="record" data-testid="track-result">
            <StatusLine data={d} />
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
    </ServiceLayout>
  );
}
