"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { activeNavHref, navItemsFor } from "@/features/auth/roles";
import HeaderDropdown, { NAV_PILL, NAV_PILL_ACTIVE, NAV_PILL_IDLE } from "./HeaderDropdown";

/** Header links after the services dropdown. Notices have no page of their own yet, so that link points at the notice board on
 *  the home page (an anchor, never marked as the current page). */
const EXTRA_LINKS = [
  { href: "/tools", labelKey: "nav.tools" },
  { href: "/guide", labelKey: "nav.guide" },
  { href: "/#notices-title", labelKey: "nav.notices" },
  { href: "/feedback", labelKey: "nav.contact" },
] as const;

/** Header bar links (U1.2): হোম · সেবাসমূহ ▾ · নাগরিক টুলস · নির্দেশিকা · নোটিশ · যোগাযোগ. The remaining pages live in the user menu. */
// client-messages: nav (labelKey values come from navItemsFor and EXTRA_LINKS)
export default function HeaderNav() {
  const t = useTranslations();
  const { user } = useAuth();
  const pathname = usePathname() ?? "/";
  const all = navItemsFor(user?.role ?? null);
  const active = activeNavHref(pathname, all);
  const home = all.find((i) => i.href === "/");
  const services = all.filter((i) => i.primary && i.href !== "/");
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const isCurrent = (href: string) => !href.includes("#") && (path === href || path.startsWith(`${href}/`));
  const onServicePage = path === "/services" || services.some((i) => i.href === active);

  const link = (href: string, label: string, isActive: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`${NAV_PILL} ${isActive ? NAV_PILL_ACTIVE : NAV_PILL_IDLE}`}
    >
      {label}
    </Link>
  );

  return (
    <nav
      aria-label={t("nav.main")}
      className="flex flex-col items-stretch gap-0.5 min-[1280px]:flex-1 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:justify-center min-[1280px]:gap-2"
    >
      {home && link(home.href, t(home.labelKey), home.href === active)}
      <HeaderDropdown
        id="services-menu"
        label={t("nav.services")}
        active={onServicePage}
        items={[
          { href: "/services", label: t("nav.allServices"), current: path === "/services" },
          ...services.map((i) => ({ href: i.href, label: t(i.labelKey), current: i.href === active })),
        ]}
      />
      {EXTRA_LINKS.map((l) => link(l.href, t(l.labelKey), isCurrent(l.href)))}
    </nav>
  );
}
