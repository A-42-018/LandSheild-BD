"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Contact, Landmark, Link2, Unlink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge, Button, Input, LoadingState, Modal, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatDateTime, localDigits } from "@/lib/intl-locale";
import { cleanNid, validNid } from "@/lib/nid";
import { useFocusFirstInvalid } from "@/lib/focus-first-invalid";
import { useLinkNid, useNid, useUnlinkNid } from "./useMy";

const KNOWN = ["NID_NOT_MATCHED", "NID_IN_USE", "INVALID_NID", "INVALID_DATE_OF_BIRTH", "NID_ALREADY_REGISTERED", "RATE_LIMITED"];
const errorKey = (e: unknown) => (e instanceof ApiError && KNOWN.includes(e.code) ? e.code : "generic");

function LinkForm() {
  const t = useTranslations("my.nid");
  const toast = useToast();
  const link = useLinkNid();
  const [nid, setNid] = useState("");
  const [dob, setDob] = useState("");
  const [touched, setTouched] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const value = cleanNid(nid);
  const errs = {
    nid: touched && !validNid(value) ? t(value ? "errors.format" : "errors.nidRequired") : undefined,
    dob: touched && !dob ? t("errors.dobRequired") : undefined,
  };

  const focus = useFocusFirstInvalid();
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validNid(value) || !dob) return focus.request();
    link.mutate({ nid: value, date_of_birth: dob }, { onSuccess: () => toast("success", t("linked")) });
  };

  return (
    <form ref={focus.ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-ink">{t("why")}</p>
      <Input
        label={t("number")}
        hint={t("numberHint")}
        value={nid}
        onChange={(e) => setNid(e.target.value)}
        error={errs.nid}
        inputMode="numeric"
        autoComplete="off"
        maxLength={40}
        required
      />
      <Input
        type="date"
        label={t("dob")}
        hint={t("dobHint")}
        value={dob}
        max={today}
        min="1900-01-01"
        onChange={(e) => setDob(e.target.value)}
        error={errs.dob}
        autoComplete="bday"
        required
      />
      {link.isError && (
        <p role="alert" data-testid="nid-error" className="text-sm text-critical">
          {t(`errors.${errorKey(link.error)}`)}
        </p>
      )}
      <p className="text-sm text-ink-muted">{t("privacy")}</p>
      <Button type="submit" loading={link.isPending} icon={<Link2 />} className="self-start">
        {t("link")}
      </Button>
    </form>
  );
}

function Linked({ last4, since }: { last4: string; since: string | null }) {
  const t = useTranslations("my.nid");
  const locale = useLocale();
  const toast = useToast();
  const unlink = useUnlinkNid();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-ink">
        <span className="font-mono text-lg" data-testid="nid-masked">
          •••• {localDigits(last4, locale)}
        </span>
        <Badge tone="verified">{t("verified")}</Badge>
      </p>
      {since && <p className="text-sm text-ink-muted">{t("linkedOn", { date: formatDateTime(since, locale, "") })}</p>}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/my/lands"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Landmark aria-hidden="true" className="h-4 w-4" />
          {t("seeLand")}
        </Link>
        <Button variant="ghost" size="sm" icon={<Unlink />} onClick={() => setConfirm(true)}>
          {t("unlink")}
        </Button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("unlinkTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t("cancel")}</Button>
            <Button
              variant="danger"
              loading={unlink.isPending}
              onClick={() =>
                unlink.mutate(undefined, {
                  onSuccess: () => {
                    setConfirm(false);
                    toast("success", t("unlinked"));
                  },
                })
              }
            >
              {t("unlinkConfirm")}
            </Button>
          </>
        }
      >
        <p className="text-ink">{t("unlinkBody")}</p>
      </Modal>
    </div>
  );
}

/** "জাতীয় পরিচয়পত্র": link the citizen's own NID once; only then does "My land" list anything. */
export default function NidCard() {
  const t = useTranslations("my.nid");
  const q = useNid();
  return (
    <section id="nid" aria-labelledby="profile-nid" className="glass-card flex scroll-mt-24 flex-col gap-4 p-5">
      <h2 id="profile-nid" className="flex items-center gap-2 text-heading-3 text-ink">
        <Contact aria-hidden="true" className="h-5 w-5 text-primary" />
        {t("title")}
      </h2>
      {q.isPending ? (
        <LoadingState />
      ) : q.data?.registered && q.data.last4 ? (
        <Linked last4={q.data.last4} since={q.data.verified_at} />
      ) : (
        <LinkForm />
      )}
    </section>
  );
}
