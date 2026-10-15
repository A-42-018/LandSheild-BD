"use client";
import { usePathname } from "@/i18n/navigation";
import Backdrop from "./Backdrop";

/** Rendered once in the locale layout: topographic backdrop on public pages; none in the officer workspace (dense data) or on the full-screen map. */
export default function PublicBackdrop() {
  const pathname = usePathname();
  if (pathname.startsWith("/officer/") || pathname === "/officer" || pathname === "/map") return null;
  return <Backdrop />;
}
