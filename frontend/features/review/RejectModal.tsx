"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@/components/ui";

export const REASON_MAX = 500;

export default function RejectModal({
  open,
  onClose,
  onConfirm,
  loading,
  failed,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
  failed: boolean;
}) {
  const t = useTranslations("review");
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
      title={t("reject.title")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={submit} loading={loading} data-testid="reject-confirm">
            {t("reject.confirm")}
          </Button>
        </>
      }
    >
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {t("reject.reasonLabel")} <span aria-hidden="true" className="text-critical">*</span>
      </label>
      <textarea
        id={id}
        value={reason}
        maxLength={REASON_MAX}
        rows={4}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={touched && empty ? true : undefined}
        aria-describedby={touched && empty ? `${id}-err` : undefined}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
      />
      {touched && empty && (
        <p id={`${id}-err`} role="alert" className="text-xs text-critical">
          {t("reject.reasonRequired")}
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-2 text-xs text-critical">
          {t("actions.rejectFailed")}
        </p>
      )}
    </Modal>
  );
}
