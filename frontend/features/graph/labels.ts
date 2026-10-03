"use client";
import { useTranslations } from "next-intl";

/** i18n helpers: backend codes → text; unknown codes fall back to the raw code. Names shown as stored. */
export function useGraphLabels() {
  const nt = useTranslations("graph.nodeType");
  const et = useTranslations("graph.edgeType");
  const tt = useTranslations("result.txType");
  const g = useTranslations("graph");
  return {
    nodeType: (c: string) => (nt.has(c) ? nt(c) : c),
    edgeType: (c: string) => (et.has(c) ? et(c) : c),
    nodeText: (type: string, label: string) => (type === "Transaction" && tt.has(label) ? tt(label) : label),
    flagged: () => g("flagged"),
  };
}
