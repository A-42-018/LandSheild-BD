import type { ApiUser } from "@/lib/api";

export type Role = ApiUser["role"];
export const ROLES: Role[] = ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"];

export const REVIEW_UP: Role[] = ["REVIEWER", "OFFICER", "ADMIN"];
export const OFFICER_UP: Role[] = ["OFFICER", "ADMIN"];
export const ADMIN_ONLY: Role[] = ["ADMIN"];

export interface NavItem {
  href: string;
  labelKey: string;
  /** undefined = public; [] not allowed */
  roles?: Role[];
  /** true = shown in the header bar; others live in the account menu (UD10) */
  primary?: boolean;
}

/** Add entries here as feature pages land (R4 matrix). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", primary: true },
  { href: "/about", labelKey: "nav.about" },
  { href: "/verify", labelKey: "nav.verify", roles: ROLES },
  { href: "/map", labelKey: "nav.map", roles: ROLES, primary: true },
  { href: "/officer", labelKey: "nav.dashboard", roles: REVIEW_UP },
  { href: "/officer/upload", labelKey: "nav.upload", roles: OFFICER_UP },
];

export function navItemsFor(role: Role | null, items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((i) => !i.roles || (role !== null && i.roles.includes(role)));
}

export function hasRole(role: Role | null | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

/** Most specific nav item whose href matches the (locale-less) pathname; null if none. */
export function activeNavHref(pathname: string, items: NavItem[]): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: string | null = null;
  for (const { href } of items) {
    const hit = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
    if (hit && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
