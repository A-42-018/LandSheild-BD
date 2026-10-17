"use client";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui";
import { cleanNid, validNid } from "@/lib/nid";

/** Survey records (khatian / porcha) have no buyer or seller, so no owner NID either. */
export const SURVEY_TYPES = ["KHATIAN", "PORCHA"];
export const needsPartyNid = (docType: string) => !SURVEY_TYPES.includes(docType);

export type Party = "buyer" | "seller";
export interface PartyNidValue {
  nid: string;
  dob: string;
}
export const EMPTY_PARTY: PartyNidValue = { nid: "", dob: "" };
export type PartyNidErrors = { nid?: "nidRequired" | "format"; dob?: "dobRequired" };

/** Both blank is fine unless `required`; one without the other never is. */
export function checkParty(v: PartyNidValue, required: boolean): PartyNidErrors {
  const nid = cleanNid(v.nid);
  if (!nid && !v.dob) return required ? { nid: "nidRequired", dob: "dobRequired" } : {};
  return { nid: !nid ? "nidRequired" : !validNid(nid) ? "format" : undefined, dob: v.dob ? undefined : "dobRequired" };
}
export const hasErrors = (e: PartyNidErrors) => !!(e.nid || e.dob);
export const toBody = (v: PartyNidValue) => ({ nid: cleanNid(v.nid), date_of_birth: v.dob });

/** NID + date of birth for one deed party. Labels and errors come from the `partyNid` messages. */
export function PartyNidFields({
  party,
  value,
  onChange,
  errors = {},
  required,
}: {
  party: Party;
  value: PartyNidValue;
  onChange: (v: PartyNidValue) => void;
  errors?: PartyNidErrors;
  required: boolean;
}) {
  const t = useTranslations("partyNid");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-2" data-testid={`party-nid-${party}`}>
      <p className="text-sm font-semibold text-ink">
        {t(party)}
        {!required && <span className="ml-1 font-normal text-ink-muted">({t("optional")})</span>}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={t("nid")}
          hint={t("nidHint")}
          value={value.nid}
          onChange={(e) => onChange({ ...value, nid: e.target.value })}
          error={errors.nid ? t(`errors.${errors.nid}`) : undefined}
          inputMode="numeric"
          autoComplete="off"
          maxLength={40}
          required={required}
        />
        <Input
          type="date"
          label={t("dob")}
          value={value.dob}
          min="1900-01-01"
          max={today}
          onChange={(e) => onChange({ ...value, dob: e.target.value })}
          error={errors.dob ? t(`errors.${errors.dob}`) : undefined}
          required={required}
        />
      </div>
    </div>
  );
}
