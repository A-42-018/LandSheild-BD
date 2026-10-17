"use client";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FileText, Landmark, UserCheck, Users, type LucideIcon } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Card, ErrorState, LoadingState } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { intlLocale } from "@/lib/intl-locale";
import type { AdminOfficerRequestList } from "@/features/officers/types";
import type { Paged } from "./types";
import LedgerCard from "./LedgerCard";

/** One count per admin list: ask for a single row and read `total` (and `pending` for officer requests). */
function useCounts() {
  const { api } = useAuth();
  return useQuery<{ users: number; records: number; documents: number; pending: number }, ApiError>({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const [u, r, d, o] = await Promise.all([
        api.get<Paged<unknown>>("/admin/users?limit=1"),
        api.get<Paged<unknown>>("/admin/land-records?limit=1"),
        api.get<Paged<unknown>>("/admin/documents?limit=1"),
        api.get<AdminOfficerRequestList>("/admin/officer-requests?status=PENDING&limit=1"),
      ]);
      return { users: u.total, records: r.total, documents: d.total, pending: o.pending };
    },
  });
}

export default function AdminOverview() {
  const t = useTranslations("admin.overview");
  const te = useTranslations("admin.console.errors");
  const locale = useLocale();
  const counts = useCounts();
  const num = new Intl.NumberFormat(intlLocale(locale));

  if (counts.isLoading) return <LoadingState />;
  if (counts.isError || !counts.data) {
    return <ErrorState message={counts.error instanceof ApiError && counts.error.status === 403 ? te("permission") : undefined} onRetry={() => counts.refetch()} />;
  }
  const c = counts.data;
  const tiles: { key: string; href: string; value: number; Icon: LucideIcon; attention?: boolean }[] = [
    { key: "pending", href: "/admin/officer-requests", value: c.pending, Icon: UserCheck, attention: c.pending > 0 },
    { key: "users", href: "/admin/users", value: c.users, Icon: Users },
    { key: "records", href: "/admin/records", value: c.records, Icon: Landmark },
    { key: "documents", href: "/admin/records", value: c.documents, Icon: FileText },
  ];
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t("tilesLabel")} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3">
        {tiles.map(({ key, href, value, Icon, attention }) => (
          <li key={key}>
            <Link href={href} data-testid={`tile-${key}`} className="glass-card flex h-full min-w-0 flex-col items-start gap-3 p-4 transition-colors hover:bg-primary-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <span aria-hidden="true" className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${attention ? "bg-review-soft text-review" : "bg-primary-soft text-primary"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-ink-muted">{t(`tiles.${key}`)}</span>
                <span className="block font-display text-3xl font-bold leading-tight text-ink">{num.format(value)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Card title={t("shortcuts")}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[["/officer", "officerArea"], ["/admin/audit-logs", "audit"], ["/admin/settings", "settings"]].map(([href, k]) => (
            <li key={href}><Link href={href} className="font-medium text-primary underline-offset-2 hover:underline">{t(`links.${k}`)}</Link></li>
          ))}
        </ul>
      </Card>
      <LedgerCard />
    </div>
  );
}
