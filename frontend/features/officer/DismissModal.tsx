"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@/components/ui";

/** Dismissing an alert needs a written reason (backend: REASON_REQUIRED). */
export default function DismissModal({
  open, land, onClose, onConfirm, loading,
}: {
  open: boolean;
  land: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const t = useTranslations("officer.alerts.dismissModal");
  const id = useId();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);
  const empty = reason.trim().length === 0;
  const submit = () => {
    setTouched(true);
    if (!empty) onConfirm(reason.trim());
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title", { land })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{t("cancel")}</Button>
          <Button variant="danger" onClick={submit} loading={loading} data-testid="dismiss-confirm">{t("confirm")}</Button>
        </>
      }
    >
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {t("label")} <span aria-hidden="true" className="text-critical">*</span>
      </label>
      <textarea
        id={id}
        value={reason}
        maxLength={500}
        rows={4}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={touched && empty ? true : undefined}
        aria-describedby={touched && empty ? `${id}-err` : undefined}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
        data-testid="dismiss-reason"
      />
      {touched && empty && (
        <p id={`${id}-err`} role="alert" className="text-xs text-critical">{t("required")}</p>
      )}
    </Modal>
  );
}
