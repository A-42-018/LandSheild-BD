/** Decorative landing backdrop: faint topographic contours and a cadastral (plot) grid that fade out down the page.
 *  Paths are computed once at module load, so the markup is static and identical on server and client. */

const TAU = Math.PI * 2;

/** One wobbly closed contour ring around (cx, cy). */
function ring(cx: number, cy: number, r: number, seed: number) {
  const pts: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const k = 1 + 0.09 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a + seed * 2.1) + 0.03 * Math.cos(7 * a - seed);
    pts.push(`${(cx + Math.cos(a) * r * k * 1.25).toFixed(1)},${(cy + Math.sin(a) * r * k).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

type Hill = { cx: number; cy: number; rings: number; step: number; seed: number };
/** All contour rings for a set of hills, as one path string. */
export const contours = (hills: Hill[]) =>
  hills.flatMap(({ cx, cy, rings, step, seed }) => Array.from({ length: rings }, (_, i) => ring(cx, cy, 28 + i * step, seed + i * 0.18))).join("");

const HILLS: Hill[] = [
  { cx: 1250, cy: 120, rings: 9, step: 34, seed: 0.6 },
  { cx: 110, cy: 520, rings: 7, step: 38, seed: 2.3 },
  { cx: 820, cy: 40, rings: 4, step: 30, seed: 4.1 },
];
const CONTOURS = contours(HILLS);

/** Irregular plot boundaries: a skewed grid with a few split parcels, like a mouza map. */
const PLOTS = (() => {
  const d: string[] = [];
  for (let x = -200; x <= 1700; x += 140) d.push(`M${x},0L${x + 260},900`);
  for (let y = 40; y <= 900; y += 110) d.push(`M0,${y}L1440,${y - 180}`);
  for (let x = -130; x <= 1700; x += 280) d.push(`M${x},120L${x + 120},540`);
  return d.join("");
})();

export default function Backdrop() {
  return (
    <div
      aria-hidden="true"
      data-testid="landing-backdrop"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1000px] overflow-hidden print:hidden"
      style={{
        maskImage: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_15%_0%,rgb(var(--primary)/0.07),transparent_70%),radial-gradient(50rem_28rem_at_90%_10%,rgb(var(--accent)/0.06),transparent_70%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMin slice" fill="none">
        <path d={PLOTS} stroke="rgb(var(--ink) / 0.06)" strokeWidth="1" />
        <path d={CONTOURS} stroke="rgb(var(--primary) / 0.16)" strokeWidth="1.1" />
      </svg>
    </div>
  );
}
