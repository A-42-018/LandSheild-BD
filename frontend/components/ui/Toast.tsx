"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, X, XCircle } from "lucide-react";

type Kind = "success" | "error";
interface Item { id: number; kind: Kind; text: string }
const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});

/** Success/error toasts for officer actions. Polite live region, 5 s, closable; useToast() is a no-op outside the provider. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [items, setItems] = useState<Item[]>([]);
  const n = useRef(0);
  const drop = useCallback((id: number) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const push = useCallback((kind: Kind, text: string) => {
    const id = ++n.current;
    setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
    window.setTimeout(() => drop(id), 5000);
  }, [drop]);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[3000] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end print:hidden">
        {items.map((i) => (
          <div key={i.id} className="glass-card toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 border-l-[4px] p-3 text-sm text-ink shadow-lift" style={{ borderLeftColor: `rgb(var(--${i.kind === "success" ? "verified" : "critical"}))` }}>
            {i.kind === "success" ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-verified" /> : <XCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-critical" />}
            <span className="flex-1">{i.text}</span>
            <button type="button" aria-label={t("close")} onClick={() => drop(i.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-primary-soft">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
