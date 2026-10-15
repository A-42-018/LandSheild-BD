"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Input, Select } from "@/components/ui";
import PageHeader from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { ScaleArt } from "@/features/landing/Illustrations";
import { ApiError } from "@/lib/api";
import { localDigits } from "@/lib/intl-locale";
import { useAuth } from "@/features/auth/AuthContext";
import { FEEDBACK_KINDS, type FeedbackKind, type FeedbackReceipt } from "./types";

const AREA =
  "min-h-32 rounded-xl border border-line bg-surface px-3 py-2 text-ink transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/25";

export default function FeedbackForm() {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const { api } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>("GRIEVANCE");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; message?: string; email?: string }>({});

  const m = useMutation<FeedbackReceipt, ApiError>({
    mutationFn: () =>
      api.request<FeedbackReceipt>("/public/feedback", {
        method: "POST",
        anonymous: true,
        body: { kind, subject, message, contact_email: email.trim() || null },
      }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (subject.trim().length < 3) next.subject = t("errors.subject");
    if (message.trim().length < 10) next.message = t("errors.message");
    if (email.trim() && !/^\S+@\S+$/.test(email.trim())) next.email = t("errors.email");
    setErrors(next);
    if (Object.keys(next).length === 0) m.mutate();
  };

  const apiErr = m.error ? (m.error.status === 429 ? "rateLimited" : m.error.code === "NETWORK_ERROR" ? "network" : "generic") : null;
  const done = m.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t("title")} purpose={t("purpose")} art={<ScaleArt />} />
      <p role="note" className="glass-card px-4 py-2 text-sm font-medium text-ink">
        {t("demoNote")}
      </p>
      {done ? (
        <Card title={t("receipt.title")} icon={<CheckCircle2 />} accent="verified" data-testid="feedback-receipt">
          <p className="text-ink-muted">{t("receipt.body")}</p>
          <p className="mt-3 text-sm text-ink-muted">{t("receipt.ref")}</p>
          <p className="font-mono text-2xl font-bold text-ink" data-testid="feedback-ref">{done.reference_no}</p>
          <p className="mt-3 text-sm text-ink-muted">{t("receipt.keep")}</p>
          <p className="mt-3">
            <Link href="/track" className="inline-flex min-h-11 items-center text-link underline underline-offset-2">{t("receipt.trackLink")}</Link>
          </p>
        </Card>
      ) : (
        <Card title={t("formTitle")} icon={<MessageSquare />}>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Select
              label={t("kind")}
              value={kind}
              onChange={(e) => setKind(e.target.value as FeedbackKind)}
              options={FEEDBACK_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
            />
            <Input label={t("subject")} required maxLength={200} value={subject} error={errors.subject} onChange={(e) => setSubject(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label htmlFor="fb-message" className="text-sm font-medium text-ink">
                {t("message")}<span aria-hidden="true" className="text-critical"> *</span>
              </label>
              <textarea
                id="fb-message"
                required
                maxLength={2000}
                className={AREA}
                value={message}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={errors.message ? "fb-message-error" : "fb-message-hint"}
                onChange={(e) => setMessage(e.target.value)}
              />
              {errors.message ? (
                <p id="fb-message-error" className="text-sm text-critical">{errors.message}</p>
              ) : (
                <p id="fb-message-hint" className="text-xs text-ink-muted">{t("messageHint", { count: localDigits(2000 - message.length, locale) })}</p>
              )}
            </div>
            <Input type="email" label={t("email")} hint={t("emailHint")} autoComplete="off" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
            {apiErr && <p role="alert" className="text-sm text-critical">{t(`errors.${apiErr}`)}</p>}
            <Button type="submit" size="lg" fullWidthOnMobile loading={m.isPending} icon={<Send />}>{t("submit")}</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
