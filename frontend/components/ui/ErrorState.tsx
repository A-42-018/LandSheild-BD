"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { errorKind } from "@/lib/error-kind";
import Button from "./Button";

export interface ErrorStateProps {
  /** What failed on this screen, e.g. "We could not load the map. Try again." Shown for errors the visitor cannot tell apart. */
  message?: string;
  /** The error itself. A missing connection, a timed-out sign-in, a refused permission and a server fault each get their own plain sentence and next step. */
  error?: unknown;
  onRetry?: () => void;
}

/** Error panel (U4.5): says what happened and what to do next, in plain words. Retry is hidden when trying again cannot help (no permission, signed out). */
export default function ErrorState({ message, error, onRetry }: ErrorStateProps) {
  const t = useTranslations();
  const kind = errorKind(error);
  let lines: string[];
  let canRetry = Boolean(onRetry);
  switch (kind) {
    case "forbidden":
      lines = [t("errors.permission")];
      canRetry = false;
      break;
    case "signedOut":
      lines = [t("errors.signedOut"), t("errors.signedOutHint")];
      canRetry = false;
      break;
    case "offline":
      lines = [t("errors.offline"), t("errors.offlineHint")];
      break;
    case "tooMany":
      lines = [t("errors.tooMany"), t("errors.tooManyHint")];
      break;
    case "server":
      lines = message ? [t("errors.server"), message] : [t("errors.server"), t("errors.serverHint")];
      break;
    default:
      lines = message ? [message] : [t("errors.generic"), t("errors.genericHint")];
  }
  return (
    <div role="alert" data-kind={kind} className="glass-card flex flex-col items-center gap-3 border-l-[3px] border-l-critical p-6 text-center">
      <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-critical-soft text-critical">
        <AlertCircle className="h-6 w-6" />
      </span>
      <p className="text-ink">
        {lines.map((line, i) => (
          <span key={i} className="block">{line}</span>
        ))}
      </p>
      {kind === "signedOut" && (
        <Link href="/login" className="inline-flex min-h-touch items-center rounded-xl px-4 font-medium text-link underline underline-offset-2">
          {t("nav.login")}
        </Link>
      )}
      {canRetry && onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
