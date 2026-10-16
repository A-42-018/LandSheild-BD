"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, FileText, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime, localDigits } from "@/lib/intl-locale";
import type { NotificationItem, ParcelBrief } from "./types";

export const resultHref = (landId: string) => `/verify/result?land_id=${encodeURIComponent(landId)}`;
export const reportHref = (id: string) => `/report/${encodeURIComponent(id)}`;

/** "Ashulia, Savar, Dhaka" + "Khatian ৬১০ · Dag ২১০" + the parcel code. */
export function ParcelLine({ p }: { p: Pick<ParcelBrief, "land_id" | "district" | "upazila" | "mouza" | "khatian_no" | "dag_no"> }) {
  const t = useTranslations("my.parcel");
  const locale = useLocale();
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{t("place", { mouza: p.mouza, upazila: p.upazila, district: p.district })}</span>
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {t("numbers", { khatian: localDigits(p.khatian_no, locale), dag: localDigits(p.dag_no, locale) })}
        <span className="ml-2 font-mono text-xs">{p.land_id}</span>
      </p>
    </div>
  );
}

/** One plain sentence per notification kind, plus where tapping it should go. */
export function useNotificationText() {
  const t = useTranslations();
  return (n: NotificationItem): { text: string; href: string | null } => {
    const land = n.land_id ?? "";
    const d = n.data ?? {};
    const tryT = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
    const href = n.kind === "REPORT_READY" && n.ref_id ? reportHref(n.ref_id) : n.land_id ? resultHref(n.land_id) : null;
    switch (n.kind) {
      case "WATCH_TRANSACTION":
        return { text: t("my.notes.kind.WATCH_TRANSACTION", { land, type: tryT(`result.txType.${d.type}`, d.type ?? "") }), href };
      case "WATCH_MUTATION":
        return { text: t("my.notes.kind.WATCH_MUTATION", { land, no: d.mutation_no ?? "" }), href };
      case "WATCH_MUTATION_STATUS":
        return { text: t("my.notes.kind.WATCH_MUTATION_STATUS", { land, no: d.mutation_no ?? "", status: tryT(`status.${d.status}`, d.status ?? "") }), href };
      case "WATCH_ENCUMBRANCE":
        return { text: t("my.notes.kind.WATCH_ENCUMBRANCE", { land, type: tryT(`result.encType.${d.type}`, d.type ?? "") }), href };
      case "REPORT_READY":
        return { text: t("my.notes.kind.REPORT_READY", { land, level: tryT(`risk.level.${d.risk_level}`, t("risk.level.UNKNOWN")) }), href };
      default:
        return { text: t("my.notes.kind.OTHER", { land }), href };
    }
  };
}

export function NotificationRow({ n, onOpen, action }: { n: NotificationItem; onOpen?: () => void; action?: ReactNode }) {
  const t = useTranslations("my.notes");
  const locale = useLocale();
  const { text, href } = useNotificationText()(n);
  const unread = !n.read_at;
  const Icon = n.kind === "REPORT_READY" ? FileText : Bell;
  return (
    <div data-testid="notification" data-unread={unread || undefined} className={`flex items-start gap-3 rounded-xl p-3 ${unread ? "bg-primary-soft/70" : ""}`}>
      <span aria-hidden="true" className="icon-tile !h-9 !w-9 !rounded-lg"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className={`text-ink ${unread ? "font-semibold" : ""}`}>
          {unread && <span className="mr-2 inline-block rounded-full bg-primary px-2 py-0.5 align-middle text-xs font-semibold text-primary-fg">{t("new")}</span>}
          {text}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">{formatDateTime(n.created_at, locale, "")}</p>
      </div>
      {href && (
        <Link href={href} onClick={onOpen} className="inline-flex min-h-touch shrink-0 items-center rounded-lg px-3 text-sm font-medium text-link underline">
          {t("open")}
        </Link>
      )}
      {action}
    </div>
  );
}
