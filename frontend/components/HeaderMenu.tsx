"use client";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import HeaderNav from "./HeaderNav";
import UserMenu from "./UserMenu";

/** Collapsible header area: nav + controls. Below 1120px it is a drop-down panel that overlays the page under a fixed-height bar
 *  (the bar never grows); from 1120px it is inline in the bar. */
export default function HeaderMenu({ controls }: { controls: ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? t("menuClose") : t("menuOpen")}
        onClick={() => setOpen((o) => !o)}
        className={`ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg border text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-[1120px]:hidden ${
          open ? "border-gold/60 bg-black/25" : "border-white/25 bg-black/15 hover:bg-black/25"
        }`}
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
      </button>
      {/* Dim the page behind the open panel; clicking it closes the menu. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`${open ? "block" : "hidden"} fixed inset-x-0 bottom-0 top-16 -z-10 bg-[rgb(6_20_14/0.45)] backdrop-blur-[2px] min-[1120px]:hidden`}
      />
      <div
        id="site-menu"
        data-open={open}
        className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-[calc(100%+1px)] flex-col gap-2 border-b border-gold/40 bg-brand-deep px-4 pb-4 pt-2 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6)] min-[1120px]:static min-[1120px]:flex min-[1120px]:flex-1 min-[1120px]:flex-row min-[1120px]:flex-nowrap min-[1120px]:items-center min-[1120px]:gap-4 min-[1120px]:border-0 min-[1120px]:bg-transparent min-[1120px]:p-0 min-[1120px]:shadow-none`}
      >
        <HeaderNav />
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 min-[1120px]:gap-3 min-[1120px]:border-0 min-[1120px]:pt-0">
          {controls}
          <span className="ml-auto min-[1120px]:ml-0">
            <UserMenu />
          </span>
        </div>
      </div>
    </>
  );
}
