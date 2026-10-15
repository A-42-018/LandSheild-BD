export type ThemeMode = "light" | "dark" | "system";
export const THEME_KEY = "ls-theme";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

/** Default is light (U3): dark only after an explicit choice. */
export function readTheme(): ThemeMode {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function saveTheme(mode: ThemeMode): void {
  saveThemeCookie(mode);
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* storage blocked: the choice only lasts for this page view */
  }
}

/** Mirror of the choice in a cookie so the server can render <html class="dark"> and a language switch never repaints light. */
function saveThemeCookie(mode: ThemeMode): void {
  try {
    document.cookie = `${THEME_KEY}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* cookies blocked: localStorage + theme-init.js still apply the theme */
  }
}

export function prefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Sets/clears the `dark` class on <html>; returns whether dark is now active. */
export function applyTheme(mode: ThemeMode): boolean {
  const dark = mode === "dark" || (mode === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}
