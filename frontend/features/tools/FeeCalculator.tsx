"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { intlLocale } from "@/lib/intl-locale";
import ToolShell from "./ToolShell";
import { calcFees, FEE_CONFIG, LOCATIONS, TRANSFERS, type Location, type Transfer } from "./fees";
import { parseNum } from "./num";

export default function FeeCalculator() {
  const t = useTranslations("tools.fees");
  const locale = useLocale();
  const [raw, setRaw] = useState("");
  const [transfer, setTransfer] = useState<Transfer>("sale");
  const [loc, setLoc] = useState<Location>("pourashava");
  const value = parseNum(raw);
  const bad = raw.trim() !== "" && Number.isNaN(value);
  const res = !Number.isNaN(value) ? calcFees(transfer, loc, value) : null;
  const nf = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });
  const money = (n: number) => `${t("currency")} ${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(n)}`;
  const basis = (k: "percent" | "fixed", r: number) => (k === "percent" ? t("basisPercent", { rate: nf.format(r) }) : t("basisFixed"));

  return (
    <ToolShell title={t("title")} purpose={t("purpose")} notice={t("disclaimer", { date: FEE_CONFIG.as_of })}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label={t("value")} inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} error={bad ? t("invalid") : undefined} hint={t("valueHint")} />
          <Select label={t("transfer")} value={transfer} onChange={(e) => setTransfer(e.target.value as Transfer)} options={TRANSFERS.map((x) => ({ value: x, label: t(`transfers.${x}`) }))} />
          <Select label={t("location")} value={loc} onChange={(e) => setLoc(e.target.value as Location)} options={LOCATIONS.map((x) => ({ value: x, label: t(`locations.${x}`) }))} />
        </div>
        {res && raw.trim() !== "" && (
          <>
            <table className="w-full text-left text-sm" data-testid="fee-table">
              <caption className="sr-only">{t("results")}</caption>
              <thead className="bg-surface-muted"><tr>
                <th scope="col" className="border border-line px-3 py-2">{t("item")}</th>
                <th scope="col" className="border border-line px-3 py-2">{t("basis")}</th>
                <th scope="col" className="border border-line px-3 py-2 text-right">{t("amount")}</th>
              </tr></thead>
              <tbody>
                {res.lines.map((l) => (
                  <tr key={l.code}>
                    <th scope="row" className="border border-line px-3 py-2 font-medium">{t(`items.${l.code}`)}</th>
                    <td className="border border-line px-3 py-2 text-ink-muted">{basis(l.kind, l.rate)}</td>
                    <td className="border border-line px-3 py-2 text-right tabular-nums">{money(l.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-primary-soft font-semibold">
                  <th scope="row" colSpan={2} className="border border-line px-3 py-2">{t("total")}</th>
                  <td className="border border-line px-3 py-2 text-right tabular-nums" data-testid="fee-total">{money(res.total)}</td>
                </tr>
              </tbody>
            </table>
            <p role="note" className="text-sm text-ink">{t("official")}</p>
            <div className="print:hidden"><Button variant="secondary" icon={<Printer />} onClick={() => window.print()}>{t("print")}</Button></div>
          </>
        )}
        <p className="text-sm text-ink-muted">{t("source", { date: FEE_CONFIG.as_of })}</p>
      </div>
    </ToolShell>
  );
}
