import type { ReactNode } from "react";

/** Template G: centred glass card with an illustration, one heading, one line and up to two actions (404, error, not allowed). */
export default function StateCard({
  art, title, body, actions, headingLevel = 1, role,
}: {
  art?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2;
  role?: "alert";
}) {
  const H = headingLevel === 1 ? "h1" : "h2";
  return (
    <div role={role} data-testid="state-card" className="glass-card mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-10 text-center sm:px-10">
      {art && <div aria-hidden="true" className="[&>svg]:h-28 [&>svg]:w-auto sm:[&>svg]:h-36">{art}</div>}
      <H className="font-display text-ink">{title}</H>
      <span aria-hidden="true" className="h-[3px] w-12 rounded-full bg-gradient-to-r from-primary to-gold" />
      {body && <p className="max-w-md leading-relaxed text-ink-muted">{body}</p>}
      {actions && <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}
