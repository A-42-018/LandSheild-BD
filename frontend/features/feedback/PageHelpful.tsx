"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";

/** Service and help pages that ask "Was this page helpful?" (exact pathnames, without the locale). */
export const RATED_PAGES = ["/verify", "/check", "/track", "/verify-document", "/services", "/faq", "/tools", "/tools/units", "/tools/fees", "/tools/inheritance"];

export default function PageHelpful() {
  const t = useTranslations("feedback.helpful");
  const pathname = usePathname() ?? "/";
  const { api } = useAuth();
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  useEffect(() => setState("idle"), [pathname]);
  if (!RATED_PAGES.includes(pathname)) return null;

  const send = (helpful: boolean) =>
    api
      .request("/public/page-rating", { method: "POST", anonymous: true, body: { page: pathname, helpful } })
      .then(() => setState("sent"))
      .catch(() => setState("failed"));

  return (
    <section aria-label={t("label")} className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-4 print:hidden" data-testid="page-helpful">
      {state === "sent" ? (
        <p role="status" className="text-ink">
          {t("thanks")} <Link href="/feedback" className="text-link underline underline-offset-2">{t("more")}</Link>
        </p>
      ) : (
        <>
          <p className="font-medium text-ink">{t("question")}</p>
          <Button variant="secondary" size="sm" icon={<ThumbsUp />} onClick={() => send(true)}>{t("yes")}</Button>
          <Button variant="secondary" size="sm" icon={<ThumbsDown />} onClick={() => send(false)}>{t("no")}</Button>
          {state === "failed" && <p role="alert" className="text-sm text-critical">{t("failed")}</p>}
        </>
      )}
    </section>
  );
}
