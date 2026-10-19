"use client";
import { CircleHelp, MessageSquareText, ScrollText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HELP_LINKS } from "@/features/help/help";

const ICONS = { faq: CircleHelp, guide: ScrollText, feedback: MessageSquareText } as const;
const ROW = "flex min-h-12 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Floating "সাহায্য" button (U1.6), bottom corner of every page. Opens a small panel: FAQ, guide, feedback and the hotline.
 *  A disclosure, not a modal: nothing behind it is hidden or trapped. Escape closes it and returns focus to the button;
 *  so do a click outside, focus leaving and navigation. Above the page (z-40), below dialogs, toasts and the full-screen map. */
export default function HelpButton() {
  const t = useTranslations("help");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      data-testid="help-button"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-2 print:hidden"
    >
      <div
        id="help-panel"
        role="region"
        aria-label={t("panelLabel")}
        hidden={!open}
        className="[&[hidden]]:hidden w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 text-ink shadow-raised"
      >
        <p className="px-3 pb-1 pt-2 text-sm font-semibold text-ink-muted">{t("title")}</p>
        <ul>
          {HELP_LINKS.map((l) => {
            const Icon = ICONS[l.id];
            return (
              <li key={l.id}>
                <Link href={l.href} className={ROW}>
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                  {t(`links.${l.id}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="help-panel"
        onClick={() => setOpen((o) => !o)}
        className="btn-gold inline-flex min-h-touch items-center gap-2 rounded-full px-5 text-sm font-bold shadow-raised transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <CircleHelp aria-hidden="true" className="h-5 w-5" />}
        {t("button")}
      </button>
    </div>
  );
}
