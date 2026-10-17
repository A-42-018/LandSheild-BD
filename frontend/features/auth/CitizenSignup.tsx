"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { Button, Input } from "@/components/ui";
import { useAuth } from "./AuthContext";
import AuthShell from "./AuthShell";
import PasswordInput from "./PasswordInput";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function citizenSignupErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "EMAIL_TAKEN" || e.status === 409) return "emailTaken";
    if (e.status === 429 || e.code === "RATE_LIMITED") return "rateLimited";
    if (e.status === 422) return "invalid";
  }
  return "generic";
}

/** Public citizen sign-up. The backend always creates a CITIZEN; officers request an account separately. */
export default function CitizenSignup() {
  const t = useTranslations("citizenSignup");
  const locale = useLocale();
  const { api } = useAuth();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [touched, setTouched] = useState(false);

  const errs = {
    name: !f.name.trim(),
    email: !EMAIL.test(f.email.trim()),
    password: f.password.length < 8,
  };
  const invalid = Object.values(errs).some(Boolean);

  const m = useMutation({
    mutationFn: () =>
      api.post("/auth/register", {
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        preferred_language: locale === "bn" ? "bn" : "en",
      }),
  });

  const focus = useFocusFirstInvalid();
  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!invalid) m.mutate();
    else focus.request();
  }

  if (m.isSuccess) {
    return (
      <AuthShell mode="signup">
        <div className="flex flex-col items-start gap-3" data-testid="citizen-signup-done">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CheckCircle2 aria-hidden="true" className="h-7 w-7" />
          </span>
          <h1 className="text-heading-2 text-ink">{t("doneTitle")}</h1>
          <p className="text-ink-muted">{t("doneBody")}</p>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-fg hover:bg-primary-hover">{t("toLogin")}</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="signup">
      <div>
        <h1 className="text-heading-2 text-ink">{t("title")}</h1>
        <p className="mt-1 text-ink-muted">{t("intro")}</p>
      </div>
      <form ref={focus.ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Input label={t("name")} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={touched && errs.name ? t("required") : undefined} />
        <Input label={t("email")} type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={touched && errs.email ? t("emailInvalid") : undefined} />
        <PasswordInput label={t("password")} required autoComplete="new-password" hint={t("passwordHint")} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={touched && errs.password ? t("passwordShort") : undefined} />
        {m.isError && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(`errors.${citizenSignupErrorKey(m.error)}`)}</span>
          </p>
        )}
        <Button type="submit" loading={m.isPending} icon={<UserPlus />} className="h-12 w-full rounded-lg shadow-[0_8px_18px_-8px_rgb(var(--primary)/0.7)]">{t("submit")}</Button>
        <p className="text-sm text-ink-muted">
          {t("haveAccount")} <Link href="/login" className="text-link underline underline-offset-2">{t("toLogin")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
