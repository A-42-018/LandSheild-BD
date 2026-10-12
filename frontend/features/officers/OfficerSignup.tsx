"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, MapPin, UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import OfficeCascade from "./OfficeCascade";
import { bi, officePath, type Office } from "./types";
import { useOfficerRequest } from "./useOffices";

const PHONE = /^\+?[0-9][0-9 -]{6,18}[0-9]$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function signupErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "EMAIL_TAKEN") return "emailTaken";
    if (e.status === 429 || e.code === "RATE_LIMITED") return "rateLimited";
    if (e.status === 404) return "officeGone";
    if (e.status === 422) return "invalid";
  }
  return "generic";
}

export default function OfficerSignup() {
  const t = useTranslations("officerSignup");
  const locale = useLocale();
  const [office, setOffice] = useState<Office | null>(null);
  const officeId = office?.id ?? "";
  const [f, setF] = useState({ name: "", email: "", password: "", designation: "", phone: "", employee_id: "", proof_note: "" });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<Office | null>(null);

  const submit = useOfficerRequest();

  const errs = {
    name: !f.name.trim(),
    email: !EMAIL.test(f.email.trim()),
    password: f.password.length < 8,
    designation: f.designation.trim().length < 2,
    phone: !PHONE.test(f.phone.trim()),
    employee_id: f.employee_id.trim().length < 2,
    office: !officeId,
  };
  const invalid = Object.values(errs).some(Boolean);

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (invalid || !office) return;
    submit.mutate(
      {
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        preferred_language: locale === "bn" ? "bn" : "en",
        office_id: officeId,
        designation: f.designation.trim(),
        phone: f.phone.trim(),
        employee_id: f.employee_id.trim(),
        proof_note: f.proof_note.trim() || undefined,
      },
      { onSuccess: () => setDone(office) },
    );
  }

  if (done) {
    return (
      <Card title={<h1 className="text-base font-semibold">{t("doneTitle")}</h1>} icon={<CheckCircle2 />} variant="record">
        <div className="flex flex-col gap-3" data-testid="signup-done">
          <p>{t("doneBody")}</p>
          <p className="rounded-md border border-line bg-surface-muted p-3 text-sm">
            <span className="font-medium">{bi(done.name_en, done.name_bn)}</span>
            <br />
            <span className="text-ink-muted">{officePath(done)}</span>
          </p>
          <p className="text-sm text-ink-muted">{t("doneHint")}</p>
          <Link href="/login" className="text-link underline-offset-2 hover:underline">{t("toLogin")}</Link>
        </div>
      </Card>
    );
  }

  return (
    <Card title={<h1 className="text-base font-semibold">{t("title")}</h1>} icon={<UserPlus />} variant="record">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <p className="text-ink-muted">{t("intro")}</p>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold"><MapPin aria-hidden="true" className="h-4 w-4" />{t("officeStep")}</legend>
          <OfficeCascade officeId={officeId} onChange={setOffice} error={touched && errs.office ? t("officeRequired") : undefined} />
        </fieldset>

        <Input label={t("name")} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={touched && errs.name ? t("required") : undefined} />
        <Input label={t("email")} type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={touched && errs.email ? t("emailInvalid") : undefined} />
        <Input label={t("password")} type="password" required autoComplete="new-password" hint={t("passwordHint")} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={touched && errs.password ? t("passwordShort") : undefined} />
        <Input label={t("designation")} required value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} error={touched && errs.designation ? t("required") : undefined} />
        <Input label={t("employeeId")} required value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} error={touched && errs.employee_id ? t("required") : undefined} />
        <Input label={t("phone")} type="tel" required autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={touched && errs.phone ? t("phoneInvalid") : undefined} />
        <div className="flex flex-col gap-1">
          <label htmlFor="proof-note" className="text-sm font-medium text-ink">{t("proof")}</label>
          <textarea
            id="proof-note"
            rows={3}
            maxLength={1000}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={f.proof_note}
            onChange={(e) => setF({ ...f, proof_note: e.target.value })}
          />
          <p className="text-xs text-ink-muted">{t("proofHint")}</p>
        </div>

        {submit.isError && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(`errors.${signupErrorKey(submit.error)}`)}</span>
          </p>
        )}
        <Button type="submit" loading={submit.isPending} icon={<UserPlus />} className="w-full">{t("submit")}</Button>
        <p className="text-sm text-ink-muted">
          {t("haveAccount")} <Link href="/login" className="text-link underline-offset-2 hover:underline">{t("toLogin")}</Link>
        </p>
      </form>
    </Card>
  );
}
