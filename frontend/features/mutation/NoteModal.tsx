"use client";
import { useEffect, useId, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { REASON_MAX } from "./ReasonModal";

/** A modal with a required free-text note and an optional two-way choice (used by recommend + appeal). */
export default function NoteModal({
  open, title, label, confirm, cancel, requiredText, choices, onClose, onConfirm, loading, failedText,
}: {
  open: boolean;
  title: string;
  label: string;
  confirm: string;
  cancel: string;
  requiredText: string;
  choices?: { value: string; label: string }[];
  onClose: () => void;
  onConfirm: (note: string, choice: string) => void;
  loading: boolean;
  failedText?: string | null;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState(choices?.[0]?.value ?? "");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setNote("");
      setChoice(choices?.[0]?.value ?? "");
      setTouched(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const short = note.trim().length < 3;
  const submit = () => {
    setTouched(true);
    if (!short) onConfirm(note.trim(), choice);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancel}</Button>
          <Button onClick={submit} loading={loading} data-testid="note-confirm">{confirm}</Button>
        </>
      }
    >
      {choices && (
        <div role="radiogroup" className="mb-3 flex flex-wrap gap-4">
          {choices.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name={`${id}-choice`} value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label} <span aria-hidden="true" className="text-critical">*</span>
      </label>
      <textarea
        id={id}
        value={note}
        maxLength={REASON_MAX}
        rows={4}
        onChange={(e) => setNote(e.target.value)}
        aria-invalid={touched && short ? true : undefined}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
      />
      {touched && short && <p role="alert" className="text-xs text-critical">{requiredText}</p>}
      {failedText && <p role="alert" className="mt-2 text-xs text-critical">{failedText}</p>}
    </Modal>
  );
}
