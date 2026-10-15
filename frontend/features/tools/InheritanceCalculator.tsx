"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { intlLocale } from "@/lib/intl-locale";
import { ScaleArt } from "@/features/landing/Illustrations";
import ToolShell from "./ToolShell";
import { EMPTY, faraid, fracStr, toNum, validate, type Heirs, type Result } from "./faraid";
import { parseNum } from "./num";
import { convert, UNITS, type Unit } from "./units";

const COUNTS = ["wives", "sons", "daughters", "brothers", "sisters"] as const;
const FLAGS = ["husband", "father", "mother"] as const;

export default function InheritanceCalculator() {
  const t = useTranslations("tools.faraid");
  const tu = useTranslations("tools.units");
  const locale = useLocale();
  const [h, setH] = useState<Heirs>(EMPTY);
  const [areaRaw, setAreaRaw] = useState("");
  const [unit, setUnit] = useState<Unit>("decimal");
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 });
  const pf = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 2 });
  const area = parseNum(areaRaw);
  const err = validate(h);
  let res: Result | null = null;
  if (!err) res = faraid(h);
  const hasArea = !Number.isNaN(area) && area > 0;
  const frac = (n: bigint | number) => new Intl.NumberFormat(intlLocale(locale)).format(Number(n));
  const fracText = (f: { n: bigint; d: bigint }) => (f.d === 1n ? frac(f.n) : `${frac(f.n)}/${frac(f.d)}`);
  const setCount = (k: (typeof COUNTS)[number], v: string) => {
    const n = Math.max(0, Math.min(30, Math.trunc(parseNum(v) || 0)));
    setH((cur) => ({ ...cur, [k]: n, ...(k === "wives" && n > 0 ? { husband: false } : {}) }));
  };

  return (
    <ToolShell title={t("title")} purpose={t("purpose")} notice={t("disclaimer")} art={<ScaleArt />}>
      <div className="flex flex-col gap-4">
        <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-medium text-ink">{t("heirs")}</legend>
          {FLAGS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-5 w-5" checked={h[k]} disabled={k === "husband" && h.wives > 0}
                onChange={(e) => setH((cur) => ({ ...cur, [k]: e.target.checked }))} />
              {t(`heir.${k}`)}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COUNTS.map((k) => (
            <Input key={k} label={t(`heir.${k}`)} type="number" min={0} max={k === "wives" ? 4 : 30} inputMode="numeric"
              value={String(h[k])} onChange={(e) => setCount(k, e.target.value)} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t("area")} inputMode="decimal" value={areaRaw} onChange={(e) => setAreaRaw(e.target.value)} hint={t("areaHint")} />
          <Select label={t("unit")} value={unit} onChange={(e) => setUnit(e.target.value as Unit)} options={UNITS.map((u) => ({ value: u, label: tu(`names.${u}`) }))} />
        </div>

        {err === "SPOUSE_BOTH" || err === "WIVES_MAX" ? <p role="alert" className="text-sm text-critical">{t(`errors.${err}`)}</p> : null}
        {err === "NO_HEIRS" ? <p className="text-sm text-ink-muted">{t("errors.NO_HEIRS")}</p> : null}

        {res && (
          <>
            <div className="glass-card overflow-x-auto !rounded-card">
            <table className="w-full text-left text-sm" data-testid="faraid-table">
              <caption className="sr-only">{t("results")}</caption>
              <thead className="bg-surface-muted"><tr>
                <th scope="col" className="border border-line px-3 py-2">{t("col.heir")}</th>
                <th scope="col" className="border border-line px-3 py-2 text-right">{t("col.share")}</th>
                <th scope="col" className="border border-line px-3 py-2 text-right">{t("col.percent")}</th>
                {hasArea && <th scope="col" className="border border-line px-3 py-2 text-right">{t("col.area")}</th>}
              </tr></thead>
              <tbody>
                {res.shares.map((s) => (
                  <tr key={s.heir}>
                    <th scope="row" className="border border-line px-3 py-2 font-medium">
                      {t(`heir.${s.heir}`)}{s.count > 1 ? ` × ${frac(s.count)}` : ""}
                      {s.count > 1 && <span className="block text-xs font-normal text-ink-muted">{t("each", { share: fracText(s.each) })}</span>}
                      <span aria-hidden="true" className="mt-1.5 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-primary-soft">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(toNum(s.total) * 100)}%` }} />
                      </span>
                    </th>
                    <td className="border border-line px-3 py-2 text-right tabular-nums">{fracText(s.total)}</td>
                    <td className="border border-line px-3 py-2 text-right tabular-nums">{pf.format(toNum(s.total))}</td>
                    {hasArea && (
                      <td className="border border-line px-3 py-2 text-right tabular-nums">
                        {nf.format(toNum(s.total) * area)} {tu(`names.${unit}`)}
                        {s.count > 1 && <span className="block text-xs text-ink-muted">{t("eachArea", { area: nf.format(toNum(s.each) * area) })}</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted" data-testid="faraid-notes">
              {res.awl && <li>{t("notes.awl")}</li>}
              {res.radd && <li>{t("notes.radd")}</li>}
              {res.umariyyatan && <li>{t("notes.umar")}</li>}
              {res.excluded.length > 0 && <li>{t("notes.excluded")}</li>}
              {fracStr(res.sum) !== "1" && <li>{t("notes.leftover")}</li>}
              <li>{t("notes.scope")}</li>
              <li>{t("notes.partition")}</li>
            </ul>
            <div className="print:hidden"><Button variant="secondary" icon={<Printer />} onClick={() => window.print()}>{t("print")}</Button></div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
