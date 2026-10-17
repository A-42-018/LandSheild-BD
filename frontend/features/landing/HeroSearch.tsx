"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileSearch, QrCode, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Input, Tabs } from "@/components/ui";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import VerifyForm from "@/features/verify/VerifyForm";
import QrScanner from "@/features/qr/QrScanner";
import { FEEDBACK_REF } from "@/features/feedback/types";
import { MUTATION_NO, normaliseNo } from "@/features/track/types";

/** A pasted QR link (any host: only its /v/{id} path and seal query are kept) or a bare land id → local /v/ path. */
export function qrTarget(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const hit = s.match(/\/v\/([A-Za-z0-9_-]{4,64})\/?(\?[^#\s]*)?/);
  if (hit) {
    const p = new URLSearchParams(hit[2] ?? "");
    const d = p.get("d");
    const h = p.get("h");
    const q = d && h ? `?d=${encodeURIComponent(d)}&h=${encodeURIComponent(h)}` : "";
    return `/v/${hit[1]}${q}`;
  }
  return /^[A-Za-z0-9_-]{4,64}$/.test(s) ? `/v/${s}` : null;
}

function TrackTab() {
  const t = useTranslations("track");
  const router = useRouter();
  const [no, setNo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const focus = useFocusFirstInvalid();
  return (
    <form
      ref={focus.ref}
      noValidate
      aria-label={t("formTitle")}
      className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const n = normaliseNo(no);
        const ok = MUTATION_NO.test(n) || FEEDBACK_REF.test(n);
        setInvalid(!ok);
        if (ok) router.push(`/track?no=${encodeURIComponent(n)}`);
        else focus.request();
      }}
    >
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
      <Button type="submit" size="lg" icon={<Search />} className="w-full sm:mt-7 sm:w-auto">
        {t("submit")}
      </Button>
    </form>
  );
}

function DocTab() {
  const t = useTranslations("home.search");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const focus = useFocusFirstInvalid();
  const open = (raw: string) => {
    const to = qrTarget(raw);
    setInvalid(!to);
    if (to) router.push(to);
    else focus.request();
  };
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col items-start gap-3">
        <p className="text-ink-muted">{t("docIntro")}</p>
        <Link
          href="/verify-document"
          data-testid="hero-doc-link"
          className="inline-flex min-h-touch items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-fg shadow-[0_6px_16px_-6px_rgb(var(--primary)/0.55)] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <FileSearch aria-hidden="true" className="h-5 w-5" />
          {t("docLink")}
        </Link>
      </div>
      <form
        ref={focus.ref}
        noValidate
        aria-label={t("qrTitle")}
        className="flex flex-col gap-3 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:ps-5 lg:pt-0"
        onSubmit={(e) => {
          e.preventDefault();
          open(code);
        }}
      >
        <QrScanner onResult={open} />
        <Input
          label={t("qrLabel")}
          autoComplete="off"
          hint={t("qrHint")}
          error={invalid ? t("qrInvalid") : undefined}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="lg" icon={<QrCode />} className="w-full sm:w-auto sm:self-start">
          {t("qrSubmit")}
        </Button>
      </form>
    </div>
  );
}

/** U1.3 (P1, P3): one card, one tab per citizen service. Nothing here needs sign-in to start. */
export default function HeroSearch() {
  const t = useTranslations("home.search");
  return (
    <div data-testid="hero-search" className="rounded-2xl border border-line bg-surface p-4 shadow-lift sm:p-6">
      <h2 className="mb-3 text-lg font-semibold text-ink">{t("title")}</h2>
      <Tabs
        variant="segmented"
        label={t("title")}
        // At 360 px three Bangla labels only fit whole-word with tighter padding.
        className="[&_[role=tab]]:px-2 sm:[&_[role=tab]]:px-4"
        tabs={[
          { id: "land", label: t("tabs.land"), content: <VerifyForm compact /> },
          { id: "track", label: t("tabs.track"), content: <TrackTab /> },
          { id: "doc", label: t("tabs.doc"), content: <DocTab /> },
        ]}
      />
    </div>
  );
}
