"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, CircleDashed, FileCheck2, XCircle, Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import StatusBadge from "@/components/domain/StatusBadge";
import { Badge, Button, Card, ErrorState, LoadingState } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { hasRole, OFFICER_UP } from "@/features/auth/roles";
import { formatArea, formatDateTime } from "@/features/result/format";
import { bi, officePath, type Office } from "@/features/officers/types";
import NoteModal from "./NoteModal";
import ReasonModal from "./ReasonModal";
import { useMutationAppeal, useMutationDetail, useMutationRecommend, useMutationTransition } from "./useMutations";
import { CHECK_CODES, REASON_REQUIRED, type MutationStatusCode } from "./types";

const CHECK_ICON: Record<string, JSX.Element> = {
  PASS: <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-verified" />,
  FAIL: <XCircle aria-hidden="true" className="h-5 w-5 text-critical" />,
  NOT_CHECKED: <CircleDashed aria-hidden="true" className="h-5 w-5 text-ink-muted" />,
};

export default function MutationDetail({ id }: { id: string }) {
  const t = useTranslations("mutation");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { user } = useAuth();
  const q = useMutationDetail(id);
  const tr = useMutationTransition(id);
  const rec = useMutationRecommend(id);
  const app = useMutationAppeal(id);
  const [note, setNote] = useState<"RECOMMEND" | "APPEAL" | null>(null);
  const [modal, setModal] = useState<"HEARING" | "REJECTED" | null>(null);

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) {
    const nf = q.error instanceof ApiError && q.error.status === 404;
    return <ErrorState message={nf ? t("notFound") : q.error instanceof ApiError && q.error.status === 403 ? te("permission") : undefined} onRetry={() => q.refetch()} />;
  }
  const m = q.data;
  const canAct = hasRole(user?.role, OFFICER_UP);
  const go = (to: string, reason?: string) =>
    tr.mutate({ to, reason }, { onSuccess: () => setModal(null) });
  const onAction = (to: string) => {
    if (REASON_REQUIRED.includes(to as MutationStatusCode)) setModal(to as "HEARING" | "REJECTED");
    else go(to);
  };
  const dt = (v: string | null) => formatDateTime(v, locale, "—");
  const timeline = [
    { key: "applied", at: m.applied_at },
    { key: "changed", at: m.status_changed_at },
    ...(m.decided_at ? [{ key: "decided", at: m.decided_at }] : []),
  ];
  const errKey =
    tr.error instanceof ApiError
      ? tr.error.code === "SELF_DECISION_FORBIDDEN"
        ? "self"
        : tr.error.status === 403
          ? "forbidden"
          : tr.error.status === 409
            ? "invalid"
            : "failed"
      : "failed";

  return (
    <div className="flex flex-col gap-4">
      <Card variant="record" title={`${t("detailTitle")} ${m.mutation_no}`} icon={<FileCheck2 />}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge code={m.status} />
          {m.fast_track && <Badge tone="verified" icon={<Zap />}>{t("fastTrack")}</Badge>}
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label={t("cols.land")}><span className="font-mono">{m.land_id}</span></Row>
          <Row label={t("cols.applicant")}>{m.applicant}</Row>
          <Row label={t("cols.area")}>{formatArea(m.area, m.area_unit, locale, m.area_unit)}</Row>
          <Row label={t("khatian")}>{`${m.previous_khatian_no ?? "—"} → ${m.new_khatian_no ?? "—"}`}</Row>
          <Row label={t("office")}>{m.ac_land_office ?? "—"}</Row>
          {m.holder_office && (
            <Row label={t("heldBy")}>
              <span data-testid="holder-office">{bi(m.holder_office.name_en, m.holder_office.name_bn)}</span>
              <br />
              <span className="text-xs text-ink-muted">{officePath(m.holder_office as Office)}</span>
            </Row>
          )}
          <Row label={t("deed")}>{m.deed_no ?? t("noDeed")}</Row>
        </dl>
        <p className="mt-3 text-sm">
          <Link href={`/verify/result?land_id=${encodeURIComponent(m.land_id)}`} className="text-link underline">{t("openLand")}</Link>
        </p>
      </Card>

      <Card title={t("checklist")} accent="primary">
        {m.checklist ? (
          <ul className="flex flex-col gap-2" data-testid="mutation-checklist">
            {CHECK_CODES.map((c) => {
              const v = m.checklist?.[c] ?? "NOT_CHECKED";
              return (
                <li key={c} className="flex items-center gap-2 text-sm">
                  {CHECK_ICON[v] ?? CHECK_ICON.NOT_CHECKED}
                  <span className="flex-1">{t(`checks.${c}`)}</span>
                  <span className="font-semibold">{t(`checkStatus.${v in CHECK_ICON ? v : "NOT_CHECKED"}`)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">{t("noChecklist")}</p>
        )}
      </Card>

      {(m.recommendation || m.appeal_reason) && (
        <Card title={t("opinions.title")}>
          <div className="flex flex-col gap-3 text-sm">
            {m.recommendation && (
              <p data-testid="recommendation">
                <span className="font-medium">{t(`opinions.${m.recommendation}`)}</span>
                {m.recommended_by_name ? ` — ${m.recommended_by_name}` : ""}
                {m.recommended_at ? ` · ${dt(m.recommended_at)}` : ""}
                <br />
                <span className="text-ink-muted">{m.recommendation_note}</span>
                <br />
                <span className="text-xs text-ink-muted">{t("opinions.advisory")}</span>
              </p>
            )}
            {m.appeal_reason && (
              <p data-testid="appeal-reason">
                <span className="font-medium">{t("opinions.appeal")}</span>
                {m.appealed_at ? ` · ${dt(m.appealed_at)}` : ""}
                <br />
                <span className="text-ink-muted">{m.appeal_reason}</span>
              </p>
            )}
          </div>
        </Card>
      )}

      <Card title={t("timeline")}>
        <ol className="flex flex-col gap-2 text-sm" data-testid="mutation-timeline">
          {timeline.map((e) => (
            <li key={e.key} className="flex justify-between gap-4 border-b border-line pb-1">
              <span>{t(`events.${e.key}`)}</span>
              <span className="text-ink-muted">{dt(e.at)}</span>
            </li>
          ))}
        </ol>
      </Card>

      {canAct && (m.can_recommend || m.can_appeal) && (
        <Card title={t("opinions.actionsTitle")}>
          <div className="flex flex-wrap gap-2">
            {m.can_recommend && (
              <Button variant="secondary" onClick={() => setNote("RECOMMEND")} data-testid="act-recommend">{t("opinions.recommend")}</Button>
            )}
            {m.can_appeal && (
              <Button variant="secondary" onClick={() => setNote("APPEAL")} data-testid="act-appeal">{t("opinions.fileAppeal")}</Button>
            )}
          </div>
        </Card>
      )}

      {canAct && m.allowed_transitions.length > 0 && (
        <Card title={t("actions.title")}>
          <div className="flex flex-wrap gap-2">
            {m.allowed_transitions.map((to) => (
              <Button
                key={to}
                variant={to === "REJECTED" ? "danger" : to === "APPROVED" ? "primary" : "secondary"}
                loading={tr.isPending && modal === null}
                onClick={() => onAction(to)}
                data-testid={`act-${to}`}
              >
                {t(`actions.${to}`)}
              </Button>
            ))}
          </div>
          {tr.isError && modal === null && (
            <p role="alert" className="mt-2 text-xs text-critical">{t(`errors.${errKey}`)}</p>
          )}
        </Card>
      )}

      {note && (
        <NoteModal
          open
          title={t(note === "RECOMMEND" ? "opinions.recommendTitle" : "opinions.appealTitle")}
          label={t(note === "RECOMMEND" ? "opinions.noteLabel" : "opinions.appealLabel")}
          confirm={t(note === "RECOMMEND" ? "opinions.recommendConfirm" : "opinions.appealConfirm")}
          cancel={t("cancel")}
          requiredText={t("reason.required")}
          choices={note === "RECOMMEND" ? [{ value: "APPROVE", label: t("opinions.APPROVE") }, { value: "REJECT", label: t("opinions.REJECT") }] : undefined}
          onClose={() => setNote(null)}
          loading={rec.isPending || app.isPending}
          failedText={rec.isError || app.isError ? t("errors.failed") : null}
          onConfirm={(text, choice) =>
            note === "RECOMMEND"
              ? rec.mutate({ decision: choice, note: text }, { onSuccess: () => setNote(null) })
              : app.mutate({ reason: text }, { onSuccess: () => setNote(null) })
          }
        />
      )}

      {modal && (
        <ReasonModal
          open
          target={modal}
          onClose={() => setModal(null)}
          onConfirm={(reason) => go(modal, reason)}
          loading={tr.isPending}
          failed={tr.isError}
        />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
