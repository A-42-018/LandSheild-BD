import type { ApiUser } from "@/lib/api";

export type Role = ApiUser["role"];
export const ROLES: Role[] = ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"];

export const REVIEW_UP: Role[] = ["REVIEWER", "OFFICER", "ADMIN"];
export const OFFICER_UP: Role[] = ["OFFICER", "ADMIN"];
export const ADMIN_ONLY: Role[] = ["ADMIN"];

/** Where a signed-in user lands when no `?next=` was given (U3.1). Citizens get "আমার ভূমি সেবা" (U3.2),
 *  reviewers "আজকের কাজ" (U3.3). Admin moves to its own area in U3.5. */
export function redirectFor(role: Role | null | undefined): string {
  if (role === "CITIZEN") return "/my";
  if (role === "REVIEWER") return "/officer/review";
  return hasRole(role, REVIEW_UP) ? "/officer" : "/";
}

/** Staff-only pages send anonymous visitors to the staff sign-in; everything else uses the citizen one. */
export function loginPathFor(allowed?: Role[]): "/login" | "/officer-login" {
  return allowed && allowed.length > 0 && allowed.every((r) => REVIEW_UP.includes(r)) ? "/officer-login" : "/login";
}

export interface NavItem {
  href: string;
  labelKey: string;
  /** undefined = public; [] not allowed */
  roles?: Role[];
  /** true = shown in the header bar (Home, and the সেবাসমূহ dropdown); others live in the account menu (UD10) */
  primary?: boolean;
}

/** Add entries here as feature pages land (R4 matrix). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", primary: true },
  { href: "/about", labelKey: "nav.about" },
  { href: "/verify", labelKey: "nav.verify", primary: true }, // U2.2: public (masked summary)
  { href: "/check", labelKey: "nav.check", roles: ROLES, primary: true },
  { href: "/track", labelKey: "nav.track", primary: true },
  { href: "/verify-document", labelKey: "nav.verifyDoc", primary: true },
  { href: "/map", labelKey: "nav.map", primary: true }, // U2.3: public (outlines + numbers)
  { href: "/my", labelKey: "nav.myArea", roles: ["CITIZEN"] },
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
