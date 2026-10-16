/** Help entry points (U1.6), shared by the home hotline strip and the floating help button. */
export const HOTLINE = "16122";

/** Where the floating button leads. `guide` goes to /faq until the real guide page exists (U4.1), like the header link. */
export const HELP_LINKS = [
  { id: "faq", href: "/faq" },
  { id: "guide", href: "/faq" },
  { id: "feedback", href: "/feedback" },
] as const;
