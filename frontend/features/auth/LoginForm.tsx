"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ClipboardCheck, Info, KeyRound, Landmark, LogIn, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { useAuth } from "./AuthContext";
import AuthShell from "./AuthShell";
import PasswordInput from "./PasswordInput";
import { canOpenPath, redirectFor } from "./roles";

export type LoginAudience = "citizen" | "staff";

/** Seeded demo users (README "Demo accounts"). */
const demoEmails = (roles: string[]) => roles.map((r) => `${r}@demo.landshield.test`);
export const DEMO_ACCOUNTS_BY_AUDIENCE: Record<LoginAudience, string[]> = {
  citizen: demoEmails(["citizen"]),
  staff: demoEmails(["reviewer", "officer", "admin"]),
};
export const DEMO_ACCOUNTS = [...DEMO_ACCOUNTS_BY_AUDIENCE.citizen, ...DEMO_ACCOUNTS_BY_AUDIENCE.staff];
/** Shown on the sign-in page so judges can test quickly; must match the backend's DEMO_PASSWORD (start.sh default). */
export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "LandShield2026!";

const ROLE_ICON: Record<string, LucideIcon> = { CITIZEN: UserRound, REVIEWER: ClipboardCheck, OFFICER: Landmark, ADMIN: ShieldCheck };

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
  // Older links used /login?as=officer for the staff copy; they now get the staff page too.
  const staff = audience === "staff" || params.get("as") === "officer";

  const m = useMutation({
    mutationFn: () => login(email, password),
    // An explicit ?next= wins when this role may open it (a stale link from another role's expired session must not
    // dump a reviewer on a "no permission" page); otherwise the role's home (redirectFor).
    onSuccess: (user) => {
      const next = params.get("next");
      const target = next ? safeNext(next) : null;
      router.replace(target && canOpenPath(user.role, target) ? target : redirectFor(user.role));
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

  const focus = useFocusFirstInvalid();
  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) return focus.request();
    m.mutate();
  }

  return (
    <AuthShell mode={staff ? "staff" : "login"}>
      <div>
        <h1 className="text-heading-2 text-ink">{t(staff ? "staffTitle" : "loginTitle")}</h1>
        <p className="mt-1 text-ink-muted">{t(staff ? "staffIntro" : "loginIntro")}</p>
      </div>
      <form ref={focus.ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
      <aside aria-labelledby="demo-accounts" className="rounded-2xl border border-dashed border-primary/35 bg-primary-soft/30 p-4 text-sm" data-testid="demo-accounts">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="icon-tile !h-9 !w-9 !rounded-lg">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p id="demo-accounts" className="font-semibold text-ink">{t("demoTitle")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{t("demoHint")}</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {DEMO_ACCOUNTS_BY_AUDIENCE[audience].map((e) => {
            const role = e.split("@")[0].toUpperCase();
            const Icon = ROLE_ICON[role] ?? UserRound;
            const picked = email === e;
            return (
              <li key={e}>
                <button
                  type="button"
                  // one tap fills the whole form: the e-mail and the shared demo password
                  onClick={() => {
                    setEmail(e);
                    setPassword(DEMO_PASSWORD);
                  }}
                  aria-pressed={picked}
                  className={`group flex min-h-12 w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2 text-left transition-all hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    picked ? "border-primary/60 ring-1 ring-primary/30" : "border-line/80"
                  }`}
                >
                  <span aria-hidden="true" className="icon-tile !h-8 !w-8 !rounded-lg">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{tr(role)}</span>
                    <span className="block truncate font-mono text-xs text-ink-muted" title={e}>{e}</span>
                  </span>
                  {picked ? (
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-verified" />
                  ) : (
                    <span aria-hidden="true" className="shrink-0 text-xs font-semibold text-primary opacity-70 group-hover:opacity-100">{t("demoUse")}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setPassword(DEMO_PASSWORD)}
          className="mt-2 flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <KeyRound aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-ink-muted">{t("demoPassword")}</span>
          <code className="rounded-md bg-surface px-2 py-0.5 font-mono text-ink ring-1 ring-line/80">{DEMO_PASSWORD}</code>
        </button>
      </aside>
      <p className="text-xs text-ink-muted">{t("notice")}</p>
    </AuthShell>
  );
}
