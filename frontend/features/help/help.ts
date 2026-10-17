/** Help entry points (U1.6), shared by the home hotline strip and the floating help button. */
export const HOTLINE = "16122";

/** Where the floating button leads. */
export const HELP_LINKS = [
  { id: "faq", href: "/faq" },
  { id: "guide", href: "/guide" },
  { id: "feedback", href: "/feedback" },
] as const;
