import type { Config } from "tailwindcss";

// Design tokens (UD1, flattened to "Formal Green" in U1). Every colour is a CSS variable holding "R G B" channels (see globals.css),
// so light/dark switch without per-component dark: classes and opacity modifiers (bg-primary/90) still work.
// Old token names (primary, surface, line, ink, verified, review, critical, pending) are unchanged.
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: c("primary"),
          fg: c("primary-fg"),
          soft: c("primary-soft"),
          hover: c("primary-hover"),
          50: "#E6F2ED",
          100: "#C7E3D8",
          200: "#94C8B5",
          300: "#5FAA90",
          400: "#2F8C6F",
          500: "#0F7F61",
          600: "#006A4E", // brand green
          700: "#00563F",
          800: "#004232",
          900: "#002E23",
        },
        link: c("link"),
        strip: c("strip"),
        accent: c("accent"),
        surface: { DEFAULT: c("surface"), muted: c("surface-muted") },
        line: c("line"),
        ink: { DEFAULT: c("ink"), muted: c("ink-muted") },
        verified: { DEFAULT: c("verified"), soft: c("verified-soft") },
        review: { DEFAULT: c("review"), soft: c("review-soft") },
        critical: { DEFAULT: c("critical"), soft: c("critical-soft"), fg: c("critical-fg") },
        pending: { DEFAULT: c("pending"), soft: c("pending-soft") },
        // UI v2 brand surface + gold accent (same on both themes).
        "brand-deep": c("brand-deep"),
        "brand-deep-2": c("brand-deep-2"),
        gold: { DEFAULT: c("gold"), strong: c("gold-strong"), soft: c("gold-soft") },
      },
      borderRadius: { md: "4px", lg: "6px", xl: "8px", "2xl": "8px", card: "14px", panel: "20px", hero: "24px" },
      boxShadow: {
        card: "none", // border-based cards (U1)
        raised: "0 2px 8px rgb(var(--ink) / 0.08)",
        glass: "0 1px 2px rgb(var(--shadow) / 0.05), 0 14px 34px -16px rgb(var(--shadow) / 0.28)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.06), 0 22px 44px -18px rgb(var(--shadow) / 0.35)",
      },
      fontSize: {
        "heading-1": ["clamp(1.75rem, 1.2rem + 2.2vw, 2.6rem)", { lineHeight: "1.2", fontWeight: "700" }],
        "heading-2": ["clamp(1.375rem, 1.1rem + 1vw, 1.75rem)", { lineHeight: "1.3", fontWeight: "700" }],
        "heading-3": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-bengali)", "system-ui", "sans-serif"],
        bn: ["var(--font-bengali)", "var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "var(--font-bengali)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
