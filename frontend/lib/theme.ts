export type ThemeMode = "light" | "dark" | "system";
export const THEME_KEY = "ls-theme";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

export function readTheme(): ThemeMode {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* storage blocked: the choice only lasts for this page view */
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
