import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

type ArtComponent = (p: { className?: string }) => JSX.Element;

/** Glass card with an icon, title, description and a 3D-style illustration top right (Online services, Citizen tools).
 *  Sizes follow the card's own width (container queries, .art-card in globals.css), not the viewport, and a float spacer
 *  keeps the text clear of the illustration: text wraps beside it, then uses the full width below. */
export default function ArtCard({ href, testId, icon: I, art: ArtFor, title, desc }: { href: string; testId: string; icon: LucideIcon; art: ArtComponent; title: string; desc: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="art-card glass-card glass-card-link group relative block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex h-full items-start gap-3 p-5">
        <span aria-hidden="true" className="icon-tile"><I className="h-5 w-5" /></span>
        <span className="block min-w-0 flex-1">
          <span aria-hidden="true" className="art-card-spacer" />
          <span className="flex items-center gap-1.5 text-[1.0625rem] font-semibold text-ink">
            {title}
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 -translate-x-1 text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{desc}</span>
        </span>
      </span>
      <ArtFor className="art-card-art pointer-events-none absolute drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03]" />
    </Link>
  );
}
