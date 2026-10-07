"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { intlLocale } from "@/lib/intl-locale";
import ToolShell from "./ToolShell";
import { parseNum } from "./num";
import { convertAll, REGIONS, UNITS, type Region, type Unit } from "./units";

export default function UnitConverter() {
  const t = useTranslations("tools.units");
  const locale = useLocale();
  const [raw, setRaw] = useState("1");
  const [from, setFrom] = useState<Unit>("decimal");
  const [region, setRegion] = useState<Region>("standard");
  const [copied, setCopied] = useState(false);
  const value = parseNum(raw);
  const [touched, setTouched] = useState(false); // an emptied field is an error, an untouched one is not
  const bad = raw.trim() !== "" ? Number.isNaN(value) : touched;
  const out = useMemo(() => (Number.isNaN(value) ? null : convertAll(value, from, region)), [value, from, region]);
  const fmt = (n: number) => new Intl.NumberFormat(intlLocale(locale), { maximumSignificantDigits: 6 }).format(n);
  const text = out ? UNITS.map((u) => `${t(`names.${u}`)}: ${fmt(out[u])}`).join("\n") : "";

  return (
    <ToolShell title={t("title")} purpose={t("purpose")}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label={t("value")} inputMode="decimal" value={raw} onChange={(e) => { setTouched(true); setRaw(e.target.value); }} error={bad ? t("invalid") : undefined} />
          <Select label={t("from")} value={from} onChange={(e) => setFrom(e.target.value as Unit)} options={UNITS.map((u) => ({ value: u, label: t(`names.${u}`) }))} />
          <Select label={t("region")} value={region} onChange={(e) => setRegion(e.target.value as Region)} hint={t("regionHint")} options={REGIONS.map((r) => ({ value: r, label: t(`regions.${r}`) }))} />
        </div>
        {out && (
          <>
            <table className="w-full text-left text-sm" data-testid="unit-table">
              <caption className="sr-only">{t("results")}</caption>
              <thead className="bg-surface-muted"><tr><th scope="col" className="border border-line px-3 py-2">{t("unit")}</th><th scope="col" className="border border-line px-3 py-2 text-right">{t("amount")}</th></tr></thead>
              <tbody>
                {UNITS.map((u) => (
                  <tr key={u} className={u === from ? "bg-primary-soft font-semibold" : undefined}>
                    <th scope="row" className="border border-line px-3 py-2 font-medium">{t(`names.${u}`)}</th>
                    <td className="border border-line px-3 py-2 text-right tabular-nums">{fmt(out[u])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3">
              <Button variant="secondary" icon={<Copy />} onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); }}>{t("copy")}</Button>
              <span role="status" className="text-sm text-ink-muted">{copied ? t("copied") : ""}</span>
            </div>
          </>
        )}
        <p className="text-sm text-ink-muted">{t("note")}</p>
      </div>
    </ToolShell>
  );
}
