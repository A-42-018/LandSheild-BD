"use client";
import { useTranslations } from "next-intl";
import { Clock, Globe, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ROLES } from "@/features/auth/roles";
import { STAFF_IDLE_MINUTES } from "@/features/auth/IdleTimeout";

/** Read-only for now: shows the rules the system enforces. Nothing here can be edited yet (said on the page). */
export default function SettingsPanel() {
  const t = useTranslations("admin.settings");
  const tr = useTranslations("roles");
  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="rounded-lg border border-line bg-surface-muted p-3 text-sm text-ink-muted">{t("readonly")}</p>
      <Card title={t("session.title")} icon={<Clock aria-hidden="true" className="h-5 w-5" />}>
        <p className="text-sm text-ink">{t("session.idle", { minutes: STAFF_IDLE_MINUTES })}</p>
      </Card>
      <Card title={t("languages.title")} icon={<Globe aria-hidden="true" className="h-5 w-5" />}>
        <p className="text-sm text-ink">{t("languages.body")}</p>
      </Card>
      <Card title={t("roles.title")} icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}>
        <ul className="flex flex-col gap-3" data-testid="roles-list">
          {ROLES.map((r) => (
            <li key={r} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Badge tone="pending">{tr(r)}</Badge>
              <span className="min-w-0 text-sm text-ink-muted">{t(`roles.${r}`)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
