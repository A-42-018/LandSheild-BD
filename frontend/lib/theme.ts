export type ThemeMode = "light" | "dark" | "system";
/** Brand green (--primary in globals.css): browser toolbar colour and the installed app's theme. */
export const BRAND_COLOR = "#006a4e";
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

/* ---- Text size (U1.1): A- / A / A+, stored like the theme (try/catch), applied as <html> font-size.
   Default is 100 %; a size is only applied after the visitor picks one. ---- */
export const TEXT_SIZE_KEY = "ls-text-size";
export const TEXT_SIZES = [100, 112.5, 125] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export function readTextSize(): TextSize {
  try {
    const v = Number(window.localStorage.getItem(TEXT_SIZE_KEY));
    return (TEXT_SIZES as readonly number[]).includes(v) ? (v as TextSize) : 100;
  } catch {
    return 100;
  }
}

export function saveTextSize(size: TextSize): void {
  try {
    window.localStorage.setItem(TEXT_SIZE_KEY, String(size));
  } catch {
    /* storage blocked: lasts for this page view only */
  }
}

export function applyTextSize(size: TextSize): void {
  document.documentElement.style.fontSize = size === 100 ? "" : `${size}%`;
}

/* ---- High contrast (U1.1): `contrast` class on <html>, off by default ---- */
export const CONTRAST_KEY = "ls-contrast";

export function readContrast(): boolean {
  try {
    return window.localStorage.getItem(CONTRAST_KEY) === "high";
  } catch {
    return false;
  }
}

export function saveContrast(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(CONTRAST_KEY, "high");
    else window.localStorage.removeItem(CONTRAST_KEY);
  } catch {
    /* storage blocked: lasts for this page view only */
  }
}

export function applyContrast(on: boolean): void {
  document.documentElement.classList.toggle("contrast", on);
}
