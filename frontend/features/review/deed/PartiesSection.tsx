"use client";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import FieldValue, { FieldGrid } from "./FieldValue";
import { AddItem, ContainerIssues, RemoveButton } from "./ListControls";
import { asField } from "./asField";
import { useEnumText, useYesNo } from "./useDeedLabels";
import type { LhdrParty, LhdrRecord } from "../types";

export const ROLES = [
  "SELLER", "BUYER", "DONOR", "DONEE", "MORTGAGOR", "MORTGAGEE", "PRINCIPAL", "ATTORNEY",
  "WAQIF", "MUTAWALLI", "SHARER", "EXCHANGER", "WITNESS", "IDENTIFIER", "OTHER",
];

/**
 * One party card: role, name, parents, address, profession, religion, nationality, share.
 * With `path` (JSON pointer of the party, e.g. /parties/0) and an editing context every value can be
 * edited and the card can be removed (H6c).
 */
export function PartyCard({
  party,
  id,
  threshold,
  path,
  what,
}: {
  party: LhdrParty;
  id: string;
  threshold: number;
  path?: string;
  /** name used in the remove button's label, e.g. "Party 1" */
  what?: string;
}) {
  const t = useTranslations("review.deed");
  const role = useEnumText("roles");
  const yn = useYesNo();
  const a = party.address;
  const roleCode = asField(party.role)?.value;
  const p = (rest: string) => (path ? `${path}/${rest}` : undefined);
  return (
    <article data-testid={`deed-party-${id}`} data-role={roleCode ? String(roleCode) : undefined} className="rounded-lg border border-line p-3">
      <h4 className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone="pending">{roleCode ? role(roleCode) : t("notRead")}</Badge>
          <span lang="bn">{String(asField(party.name)?.value ?? "")}</span>
        </span>
        {path && <RemoveButton id={id} path={path} what={what ?? id} />}
      </h4>
      <FieldGrid>
        <FieldValue id={`${id}_role`} label={t("role")} field={party.role} threshold={threshold} format={role} path={p("role")} kind="select" options={ROLES} />
        <FieldValue id={`${id}_honorific`} label={t("honorific")} field={party.honorific} threshold={threshold} path={p("honorific")} />
        <FieldValue id={`${id}_name`} label={t("name")} field={party.name} threshold={threshold} path={p("name")} />
        <FieldValue id={`${id}_father`} label={t("father")} field={party.father?.name} threshold={threshold} path={p("father/name")} />
        <FieldValue id={`${id}_father_deceased`} label={t("deceased")} field={party.father?.deceased} threshold={threshold} format={yn} path={p("father/deceased")} kind="boolean" />
        <FieldValue id={`${id}_husband`} label={t("husband")} field={party.husband?.name} threshold={threshold} path={p("husband/name")} />
        <FieldValue id={`${id}_mother`} label={t("mother")} field={party.mother} threshold={threshold} path={p("mother")} />
        <FieldValue id={`${id}_village`} label={t("village")} field={a?.village} threshold={threshold} path={p("address/village")} />
        <FieldValue id={`${id}_post`} label={t("post")} field={a?.post} threshold={threshold} path={p("address/post")} />
        <FieldValue id={`${id}_thana`} label={t("thana")} field={a?.thana} threshold={threshold} path={p("address/thana")} />
        <FieldValue id={`${id}_district`} label={t("district")} field={a?.district} threshold={threshold} path={p("address/district")} />
        <FieldValue id={`${id}_profession`} label={t("profession")} field={party.profession} threshold={threshold} path={p("profession")} />
        <FieldValue id={`${id}_religion`} label={t("religion")} field={party.religion} threshold={threshold} path={p("religion")} />
        <FieldValue id={`${id}_nationality`} label={t("nationality")} field={party.nationality} threshold={threshold} path={p("nationality")} />
        <FieldValue id={`${id}_share`} label={t("share")} field={party.share} threshold={threshold} path={p("share")} />
      </FieldGrid>
    </article>
  );
}

/** D. Parties (witnesses are in the Execution section): cards with add / remove (H6c). */
export default function PartiesSection({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const role = useEnumText("roles");
  const parties = record.parties ?? [];
  return (
    <Card title={t("sections.parties")} icon={<Users />} data-testid="deed-section-parties">
      <div className="flex flex-col gap-3">
        <ContainerIssues paths={["/parties"]} />
        {parties.length === 0 ? (
          <p className="text-sm text-ink-muted" data-testid="deed-parties-empty">{t("none")}</p>
        ) : (
          parties.map((p, i) => (
            <PartyCard key={i} party={p} id={`party${i}`} threshold={threshold} path={`/parties/${i}`} what={t("partyN", { n: i + 1 })} />
          ))
        )}
        <AddItem
          id="party"
          path="/parties/-"
          title={t("addParty")}
          select={{ label: t("role"), initial: "SELLER", options: ROLES.map((r) => ({ value: r, label: role(r) })) }}
          text={{ label: t("name") }}
          build={(r, name) => (name ? { role: r, name } : { role: r })}
        />
      </div>
    </Card>
  );
}
