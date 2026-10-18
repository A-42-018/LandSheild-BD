"use client";
import { useTranslations } from "next-intl";
import FieldValue, { FieldGrid } from "./FieldValue";
import { AddItem, ContainerIssues, RemoveButton } from "./ListControls";
import { PartyCard } from "./PartiesSection";
import { useEnumText } from "./useDeedLabels";
import type { LhdrRecord } from "../types";

const STAMP_TYPES = ["REVENUE", "NON_JUDICIAL", "COURT_FEE", "OTHER"];

/** Witnesses as party cards with add / remove (H6c). */
export function WitnessList({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const witnesses = record.execution?.witnesses ?? [];
  return (
    <div className="flex flex-col gap-2" data-testid="deed-witnesses">
      <h4 className="text-sm font-semibold text-ink">{t("witnesses")}</h4>
      <ContainerIssues paths={["/execution/witnesses"]} />
      {witnesses.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}
      {witnesses.map((w, i) => (
        <PartyCard key={i} party={w} id={`witness${i}`} threshold={threshold} path={`/execution/witnesses/${i}`} what={t("witnessN", { n: i + 1 })} />
      ))}
      <AddItem
        id="witness"
        path="/execution/witnesses/-"
        title={t("addWitness")}
        text={{ label: t("name"), required: true }}
        build={(_s, name) => ({ role: "WITNESS", name })}
      />
    </div>
  );
}

/** Stamps: value + type, add / remove (H6c). */
export function StampList({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const stampType = useEnumText("stampTypes");
  const stamps = record.execution?.stamps ?? [];
  return (
    <div className="flex flex-col gap-2" data-testid="deed-stamps">
      <h4 className="text-sm font-semibold text-ink">{t("stamps")}</h4>
      <ContainerIssues paths={["/execution/stamps"]} />
      {stamps.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}
      {stamps.map((s, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-lg border border-line p-2" data-testid={`deed-stamp-${i}`}>
          <FieldGrid>
            <FieldValue id={`stamp${i}`} label={t("stampN", { n: i + 1 })} field={s.value} threshold={threshold} path={`/execution/stamps/${i}/value`} />
            <FieldValue id={`stamp${i}_type`} label={t("stampType", { n: i + 1 })} field={s.type} threshold={threshold} format={stampType} path={`/execution/stamps/${i}/type`} kind="select" options={STAMP_TYPES} />
          </FieldGrid>
          <div>
            <RemoveButton id={`stamp${i}`} path={`/execution/stamps/${i}`} what={t("stampN", { n: i + 1 })} />
          </div>
        </div>
      ))}
      <AddItem
        id="stamp"
        path="/execution/stamps/-"
        title={t("addStamp")}
        select={{ label: t("stampKind"), initial: "REVENUE", options: STAMP_TYPES.map((s) => ({ value: s, label: stampType(s) })) }}
        text={{ label: t("stampValue"), required: true }}
        build={(type, value) => ({ type, value })}
      />
    </div>
  );
}

/** Seals: text, add / remove (H6c). */
export function SealList({ record, threshold }: { record: LhdrRecord; threshold: number }) {
  const t = useTranslations("review.deed");
  const seals = record.execution?.seals ?? [];
  return (
    <div className="flex flex-col gap-2" data-testid="deed-seals">
      <h4 className="text-sm font-semibold text-ink">{t("seals")}</h4>
      <ContainerIssues paths={["/execution/seals"]} />
      {seals.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}
      <FieldGrid>
        {seals.map((s, i) => (
          <div key={i} className="flex min-w-0 items-start justify-between gap-2">
            <FieldValue id={`seal${i}`} label={t("sealN", { n: i + 1 })} field={s} threshold={threshold} path={`/execution/seals/${i}`} />
            <RemoveButton id={`seal${i}`} path={`/execution/seals/${i}`} what={t("sealN", { n: i + 1 })} />
          </div>
        ))}
      </FieldGrid>
      <AddItem id="seal" path="/execution/seals/-" title={t("addSeal")} text={{ label: t("sealText"), required: true }} build={(_s, v) => v} />
    </div>
  );
}
