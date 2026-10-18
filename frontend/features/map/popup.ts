import { formatArea } from "@/features/result/format";
import { localDigits } from "@/lib/intl-locale";
import type { MapPropsDto } from "./types";

export interface PopupLabels {
  landId: string;
  dag: string;
  khatian: string;
  area: string;
  status: string;
  risk: string;
  view: string;
  /** Route locale: numbers show in its digits (land IDs stay Latin). */
  locale: string;
  /** Translate a backend code; must fall back to the raw code when unknown. */
  statusText: (code: string) => string;
  riskText: (code: string) => string;
  unitText: (code: string) => string;
}

/**
 * Popup content as DOM nodes with textContent only (never innerHTML), so stored values can
 * not inject markup. Shows only the public-safe properties: no owner names, no hashes.
 */
export function buildPopup(
  p: MapPropsDto,
  labels: PopupLabels,
  href: string,
  onOpen: (landId: string) => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "ls-popup";
  const title = document.createElement("strong");
  title.textContent = p.land_id;
  root.appendChild(title);

  const dl = document.createElement("dl");
  const rows: [string, string][] = [
    [labels.landId, p.land_id],
    [labels.dag, localDigits(p.dag_no, labels.locale)],
    [labels.khatian, localDigits(p.khatian_no, labels.locale)],
    [labels.area, formatArea(p.area, p.area_unit, labels.locale, labels.unitText(p.area_unit))],
    [labels.status, labels.statusText(p.status)],
    [labels.risk, labels.riskText(p.risk_level)],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.append(dt, dd);
  }
  root.appendChild(dl);

  const a = document.createElement("a");
  a.href = href;
  a.textContent = labels.view;
  a.addEventListener("click", (ev) => {
    ev.preventDefault();
    onOpen(p.land_id);
  });
  root.appendChild(a);
  return root;
}
