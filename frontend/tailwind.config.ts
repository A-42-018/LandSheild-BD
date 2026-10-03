import type { Config } from "tailwindcss";

// Design tokens (UD1). Every colour is a CSS variable holding "R G B" channels (see globals.css),
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
          50: "#EFF5FC",
          100: "#DCE9F8",
          200: "#BCD3F0",
          300: "#8FB4E3",
          400: "#5C8FD1",
          500: "#2F6BB5",
          600: "#1A4F94",
          700: "#0F3D7A",
          800: "#0A2F61",
          900: "#002850", // logo navy
        },
        surface: { DEFAULT: c("surface"), muted: c("surface-muted") },
        line: c("line"),
        ink: { DEFAULT: c("ink"), muted: c("ink-muted") },
        verified: { DEFAULT: c("verified"), soft: c("verified-soft") },
        review: { DEFAULT: c("review"), soft: c("review-soft") },
        critical: { DEFAULT: c("critical"), soft: c("critical-soft"), fg: c("critical-fg") },
        pending: { DEFAULT: c("pending"), soft: c("pending-soft") },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, rgb(var(--grad-from)) 0%, rgb(var(--grad-to)) 100%)",
        "brand-gradient-soft": "linear-gradient(180deg, rgb(var(--grad-soft-from)) 0%, rgb(var(--grad-soft-to)) 100%)",
      },
      borderRadius: { md: "8px", lg: "12px", xl: "16px", "2xl": "20px" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.08)",
        raised: "0 4px 14px rgb(var(--shadow) / 0.12)",
      },
      fontSize: {
        "heading-1": ["2.25rem", { lineHeight: "2.5rem", fontWeight: "700" }],
        "heading-2": ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        "heading-3": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-bengali)", "system-ui", "sans-serif"],
        bn: ["var(--font-bengali)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
