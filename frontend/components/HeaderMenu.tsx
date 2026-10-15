"use client";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import HeaderNav from "./HeaderNav";
import UserMenu from "./UserMenu";

/** Collapsible header area: nav + controls. Below `md` it is a toggled panel; from `md` it is always visible. */
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
        className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/40 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-[1120px]:hidden"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
      </button>
      <div
        id="site-menu"
        data-open={open}
        className={`${open ? "flex" : "hidden"} basis-full flex-col gap-3 border-t border-white/20 pb-3 pt-3 min-[1120px]:flex min-[1120px]:flex-1 min-[1120px]:basis-auto min-[1120px]:flex-row min-[1120px]:flex-nowrap min-[1120px]:items-center min-[1120px]:gap-4 min-[1120px]:border-0 min-[1120px]:p-0`}
      >
        <HeaderNav />
        <div className="flex flex-wrap items-center gap-2 min-[1120px]:gap-3">
          {controls}
          <UserMenu />
        </div>
      </div>
    </>
  );
}
