"use client";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useUnreadCount } from "@/features/my/useMy";
import { localDigits } from "@/lib/intl-locale";

/** Header bell (U3.7): unread count of the citizen's notifications, links to the inbox. Rendered for citizens only: they are the
 *  only role that has a watch list, so staff would always see an empty inbox. */
export default function NotificationBell({ className }: { className: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const unread = useUnreadCount().data ?? 0;
  const current = usePathname() === "/my/notifications";
  return (
    <Link
      href="/my/notifications"
      aria-current={current ? "page" : undefined}
      aria-label={unread > 0 ? t("bellUnread", { count: unread }) : t("bell")}
      className={`relative ${className}`}
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
      {unread > 0 && (
        <span
          data-testid="bell-badge"
          aria-hidden="true"
          className="absolute -right-1 -top-1 min-w-5 rounded-full bg-critical px-1 text-center text-[0.7rem] font-bold leading-5 text-critical-fg"
        >
          {unread > 99 ? `${localDigits(99, locale)}+` : localDigits(unread, locale)}
        </span>
      )}
    </Link>
  );
}
