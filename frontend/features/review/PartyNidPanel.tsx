"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Contact, Pencil, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { localDigits } from "@/lib/intl-locale";
import { useAuth } from "@/features/auth/AuthContext";
import type { DocumentOut } from "@/features/upload/types";
import {
  EMPTY_PARTY,
  PartyNidFields,
  checkParty,
  hasErrors,
  toBody,
  type Party,
  type PartyNidErrors,
  type PartyNidValue,
} from "@/features/upload/PartyNidFields";

const API_CODES = ["INVALID_NID", "INVALID_DATE_OF_BIRTH", "SAME_PARTY_NID", "DOCUMENT_NOT_EDITABLE"];
export const nidErrorKey = (e: unknown) => (e instanceof ApiError && API_CODES.includes(e.code) ? e.code : "generic");

function PartyRow({ docId, party, last4, editable }: { docId: string; party: Party; last4?: string; editable: boolean }) {
  const t = useTranslations("partyNid");
  const locale = useLocale();
  const toast = useToast();
  const { api } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!last4 && party === "buyer");
  const [value, setValue] = useState<PartyNidValue>(EMPTY_PARTY);
  const [errors, setErrors] = useState<PartyNidErrors>({});

  const save = useMutation<DocumentOut, ApiError, PartyNidValue | null>({
    mutationFn: (v) => api.patch<DocumentOut>(`/documents/${docId}/party-nids`, { [party]: v ? toBody(v) : null }),
    onSuccess: (doc) => {
      qc.setQueryData(["document", docId], doc);
      setEditing(false);
      setValue(EMPTY_PARTY);
      toast("success", t("saved"));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = checkParty(value, true);
    setErrors(errs);
    if (!hasErrors(errs)) save.mutate(value);
  };

  return (
    <div className="flex flex-col gap-2 py-3" data-testid={`review-nid-${party}`}>
      {editing && editable ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <PartyNidFields party={party} value={value} onChange={setValue} errors={errors} required={party === "buyer"} />
          {save.isError && <p role="alert" className="text-sm text-critical">{t(`errors.${nidErrorKey(save.error)}`)}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" icon={<Save />} loading={save.isPending}>{t("save")}</Button>
            {last4 && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>{t("cancel")}</Button>}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">{t(party)}</p>
            {last4 ? (
              <p className="flex items-center gap-2">
                <span className="font-mono" data-testid={`review-nid-${party}-masked`}>•••• {localDigits(last4, locale)}</span>
                <Badge tone="verified">{t("entered")}</Badge>
              </p>
            ) : (
              <p className="text-sm text-ink-muted">{t("missing")}</p>
            )}
          </div>
          {editable && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<Pencil />} onClick={() => setEditing(true)}>
                {last4 ? t("change") : t("add")}
              </Button>
              {last4 && party === "seller" && (
                <Button variant="ghost" size="sm" loading={save.isPending} onClick={() => save.mutate(null)}>{t("remove")}</Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "মালিকের এনআইডি" on the review page: shows what the office entered (last 4 digits) and lets the
 *  reviewer add or correct it. The buyer's NID is required before the deed can be approved. */
export default function PartyNidPanel({ doc, editable }: { doc: DocumentOut; editable: boolean }) {
  const t = useTranslations("partyNid");
  const nids = doc.party_nids ?? {};
  return (
    <Card title={t("reviewTitle")} icon={<Contact />}>
      <p className="text-sm text-ink-muted">{t("reviewIntro")}</p>
      <div className="divide-y divide-line">
        {(["buyer", "seller"] as const).map((p) => (
          <PartyRow key={`${p}-${nids[p] ?? ""}`} docId={doc.id} party={p} last4={nids[p]} editable={editable} />
        ))}
      </div>
    </Card>
  );
}
