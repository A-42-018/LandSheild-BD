"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Info, LogIn } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";
import AuthShell from "./AuthShell";
import PasswordInput from "./PasswordInput";
import { redirectFor } from "./roles";

export type LoginAudience = "citizen" | "staff";

/** Seeded demo users (README "Demo accounts"); the password is never shown in the UI. */
const demoEmails = (roles: string[]) => roles.map((r) => `${r}@demo.landshield.test`);
export const DEMO_ACCOUNTS_BY_AUDIENCE: Record<LoginAudience, string[]> = {
  citizen: demoEmails(["citizen"]),
  staff: demoEmails(["reviewer", "officer", "admin"]),
};
export const DEMO_ACCOUNTS = [...DEMO_ACCOUNTS_BY_AUDIENCE.citizen, ...DEMO_ACCOUNTS_BY_AUDIENCE.staff];

export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

/** `audience` picks the page copy, the demo accounts and the shell tab; any role can sign in on either page and lands on its own home. */
export default function LoginForm({ audience = "citizen" }: { audience?: LoginAudience }) {
  const t = useTranslations("auth");
  const ti = useTranslations("auth.idle");
  const tr = useTranslations("roles");
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const staff = audience === "staff";

  const m = useMutation({
    mutationFn: () => login(email, password),
    // An explicit ?next= wins; otherwise the role's home (redirectFor).
    onSuccess: (user) => {
      const next = params.get("next");
      router.replace(next ? safeNext(next) : redirectFor(user.role));
    },
  });

  const rejectReason =
    m.error instanceof ApiError && m.error.code === "ACCOUNT_REJECTED"
      ? String((m.error.details as { reason?: string } | undefined)?.reason ?? "")
      : "";
  const errKey = (() => {
    const e = m.error;
    if (!e) return null;
    if (e instanceof ApiError) {
      if (e.code === "ACCOUNT_PENDING") return "accountPending";
      if (e.code === "ACCOUNT_REJECTED") return "accountRejected";
      if (e.status === 429 || e.code === "RATE_LIMITED") return "rateLimited";
      if (e.code === "NETWORK_ERROR") return "network";
      if (e.status === 401 || e.status === 422 || e.code === "INVALID_CREDENTIALS") return "invalidCredentials";
    }
    return "network";
  })();

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) return;
    m.mutate();
  }

  return (
    <AuthShell mode={staff ? "staff" : "login"}>
      <div>
        <h1 className="text-heading-2 text-ink">{t(staff ? "staffTitle" : "loginTitle")}</h1>
        <p className="mt-1 text-ink-muted">{t(staff ? "staffIntro" : "loginIntro")}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {params.get("expired") === "1" && (
          <p role="status" className="rounded-md border border-line bg-primary-soft px-3 py-2 text-sm text-ink">{ti("expired")}</p>
        )}
        <Input
          label={t("email")}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={touched && !email.trim() ? t("emailRequired") : undefined}
        />
        <PasswordInput
          label={t("password")}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched && !password ? t("passwordRequired") : undefined}
        />
        {errKey && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t(errKey)}
              {errKey === "accountRejected" && rejectReason ? ` ${t("rejectReason", { reason: rejectReason })}` : ""}
            </span>
          </p>
        )}
        <Button type="submit" loading={m.isPending} icon={<LogIn />} className="h-12 w-full rounded-lg shadow-[0_8px_18px_-8px_rgb(var(--primary)/0.7)]">
          {t("submit")}
        </Button>
      </form>
      <aside aria-labelledby="demo-accounts" className="glass-card p-4 text-sm" data-testid="demo-accounts">
        <p id="demo-accounts" className="flex items-center gap-2 font-semibold text-ink">
          <Info aria-hidden="true" className="h-4 w-4 text-primary" />
          {t("demoTitle")}
        </p>
        <p className="mt-1 text-ink-muted">{t("demoHint")}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS_BY_AUDIENCE[audience].map((e) => (
            <li key={e}>
              <button
                type="button"
                onClick={() => setEmail(e)}
                className="flex min-h-11 w-full flex-col items-start gap-1.5 rounded-xl border border-line/80 bg-surface px-3 py-2.5 text-left shadow-[0_2px_6px_-3px_rgb(var(--shadow)/0.2)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Badge tone="pending">{tr(e.split("@")[0].toUpperCase())}</Badge>
                <span className="break-all font-mono text-xs text-link">{e}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <p className="text-xs text-ink-muted">{t("notice")}</p>
    </AuthShell>
  );
}
