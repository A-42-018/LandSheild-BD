"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { applyTheme, prefersDark, readTheme, saveTheme, THEME_MODES, type ThemeMode } from "@/lib/theme";

const ICONS: Record<ThemeMode, JSX.Element> = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
};

export default function ThemeToggle({ variant = "default" }: { variant?: "default" | "onBrand" }) {
  const t = useTranslations("theme");
  const onBrand = variant === "onBrand";
  const [mode, setMode] = useState<ThemeMode>("system");
  const [sysDark, setSysDark] = useState(false);

  useEffect(() => {
    setMode(readTheme());
    setSysDark(prefersDark());
  }, []);

  // Header variant: only sun | moon (UD10). A saved "system" choice shows whatever the OS currently resolves to.
  const modes: ThemeMode[] = onBrand ? ["light", "dark"] : THEME_MODES;
  const shown: ThemeMode = onBrand && mode === "system" ? (sysDark ? "dark" : "light") : mode;

  // While on "system", follow OS changes live.
  useEffect(() => {
    if (mode !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setSysDark(prefersDark());
      applyTheme("system");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  const choose = (m: ThemeMode) => {
    setMode(m);
    saveTheme(m);
    applyTheme(m);
  };

  return (
    <div role="group" aria-label={t("label")} className={`inline-flex rounded-lg border p-0.5 ${onBrand ? "border-white/30 bg-white/10" : "border-line bg-surface"}`}>
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={shown === m}
          aria-label={t(m)}
          title={t(m)}
          onClick={() => choose(m)}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 ${
            onBrand
              ? `focus-visible:ring-white/70 ${shown === m ? "bg-white text-[rgb(15_61_122)]" : "text-white hover:bg-white/15"}`
              : `focus-visible:ring-primary/50 ${shown === m ? "bg-primary text-primary-fg" : "text-ink-muted hover:text-ink"}`
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[m]}
          </svg>
        </button>
      ))}
    </div>
  );
}
