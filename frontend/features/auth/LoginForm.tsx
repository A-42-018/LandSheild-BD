"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Info, LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button, Card, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";

/** Seeded demo users (README "Demo accounts"); the password is never shown in the UI. */
export const DEMO_ACCOUNTS = ["citizen", "reviewer", "officer", "admin"].map((r) => `${r}@demo.landshield.test`);

export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

export default function LoginForm() {
  const t = useTranslations("auth");
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const m = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => router.replace(safeNext(params.get("next"))),
  });

  const errKey = (() => {
    const e = m.error;
    if (!e) return null;
    if (e instanceof ApiError) {
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
    <Card title={<h1 className="text-base font-semibold">{t("loginTitle")}</h1>} icon={<ShieldCheck />} variant="record">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <p className="text-ink-muted">{t("loginIntro")}</p>
        <Input
          label={t("email")}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={touched && !email.trim() ? t("emailRequired") : undefined}
        />
        <Input
          label={t("password")}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched && !password ? t("passwordRequired") : undefined}
        />
        {errKey && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(errKey)}</span>
          </p>
        )}
        <Button type="submit" loading={m.isPending} icon={<LogIn />} className="w-full">
          {t("submit")}
        </Button>
      </form>
      <aside aria-labelledby="demo-accounts" className="mt-5 rounded-md border border-line bg-surface-muted p-3 text-sm" data-testid="demo-accounts">
        <p id="demo-accounts" className="flex items-center gap-2 font-semibold text-ink">
          <Info aria-hidden="true" className="h-4 w-4 text-ink-muted" />
          {t("demoTitle")}
        </p>
        <p className="mt-1 text-ink-muted">{t("demoHint")}</p>
        <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-ink">
          {DEMO_ACCOUNTS.map((e) => (
            <li key={e}>
              <button type="button" onClick={() => setEmail(e)} className="rounded py-1 text-left text-link underline-offset-2 hover:underline">
                {e}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <p className="mt-4 text-xs text-ink-muted">{t("notice")}</p>
    </Card>
  );
}
