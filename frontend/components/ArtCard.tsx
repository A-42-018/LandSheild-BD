import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

type ArtComponent = (p: { className?: string }) => JSX.Element;

/** Glass card with an icon, title, description and a 3D-style illustration on the right (Online services, Citizen tools). */
export default function ArtCard({ href, testId, icon: I, art: ArtFor, title, desc }: { href: string; testId: string; icon: LucideIcon; art: ArtComponent; title: string; desc: string }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`glass-card glass-card-link group relative flex h-full min-h-[8rem] items-start gap-3 p-5 pr-[7.5rem] sm:min-h-[8.75rem] sm:pr-[10rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      <span aria-hidden="true" className="icon-tile"><I className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[1.0625rem] font-semibold text-ink">
          {title}
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 -translate-x-1 text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{desc}</span>
      </span>
      <ArtFor className="pointer-events-none absolute -top-5 right-1 h-[7.5rem] w-[7.5rem] drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03] sm:-top-7 sm:right-2 sm:h-[9.5rem] sm:w-[10rem]" />
    </Link>
  );
}
