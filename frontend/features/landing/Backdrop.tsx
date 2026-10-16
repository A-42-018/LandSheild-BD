/** Decorative landing backdrop: faint topographic contours, a cadastral (plot) grid and a nakshi kantha stitch layer that fade out down the page.
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

/** Paddy seedlings: a small three-blade tuft at (x, y). */
const tuft = (x: number, y: number) => `M${x},${y}v-11M${x},${y}l-5,-8M${x},${y}l5,-8`;
/** Kantha filler flower: eight stitched rays around a small ring. */
const flower = (x: number, y: number) =>
  `M${x - 4},${y}a4,4 0 1 0 8,0a4,4 0 1 0 -8,0M${x},${y - 6}v-6M${x},${y + 6}v6M${x - 6},${y}h-6M${x + 6},${y}h6` +
  `M${x - 5},${y - 5}l-4,-4M${x + 5},${y + 5}l4,4M${x - 5},${y + 5}l-4,4M${x + 5},${y - 5}l4,-4`;

/** One 340 px nakshi kantha tile, drawn as running-stitch (dashed) line art: hut, boat on the river, paddy plot, banyan
 *  tree, a small mouza grid, and filler flowers. Original artwork; tiled through an SVG <pattern>. */
export const KANTHA_TILE = [
  // hut with a curved thatch roof
  "M16,66Q64,14 112,66M28,66V106H100V66M56,106V84H72V106M42,52L50,66M64,30V66M86,52L78,66",
  // boat (nouka) with a sail, and river ripples
  "M180,92Q238,122 300,92Q238,104 180,92M236,96V36M236,40Q270,58 262,90M176,114q10,-6 20,0t20,0t20,0t20,0t20,0t20,0",
  // paddy plot with rows of seedlings
  "M20,200L140,186L150,296L30,306Z",
  ...[222, 248, 274].flatMap((y, r) => [44, 66, 88, 110].map((x) => tuft(x + r * 3, y + 18 - x / 8))),
  // banyan tree with aerial roots
  "M206,234a18,18 0 0 1 4,-34a22,22 0 0 1 38,-14a20,20 0 0 1 36,10a18,18 0 0 1 4,38ZM240,234V302M252,234V302M224,238V290M268,238V286M196,304H300",
  // mouza grid: one plot marked with a dot
  "M128,126L190,118L196,178L134,186ZM159,122L165,182M131,156L193,148M176,166a2,2 0 1 0 0.1,0",
  flower(160, 50),
  flower(64, 156),
  flower(170, 262),
  flower(312, 160),
].join("");

/** Kantha layer (U1.8, roadmap P14): stitched folk line art in the side margins only. A horizontal mask keeps it out of the
 *  75rem content column, so text never sits on the pattern; hidden in high-contrast mode. */
function KanthaLayer() {
  const gutters = "linear-gradient(to right, #000 calc(50% - 40rem), transparent calc(50% - 36rem), transparent calc(50% + 36rem), #000 calc(50% + 40rem))";
  return (
    <svg
      data-testid="kantha-layer"
      className="absolute inset-0 h-full w-full [.contrast_&]:hidden"
      style={{ maskImage: gutters, WebkitMaskImage: gutters }}
      fill="none"
    >
      <defs>
        <pattern id="ls-kantha" width="340" height="340" patternUnits="userSpaceOnUse">
          <path d={KANTHA_TILE} stroke="rgb(var(--kantha))" strokeWidth="1.7" strokeDasharray="4 3.5" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ls-kantha)" />
    </svg>
  );
}

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
      <KanthaLayer />
    </div>
  );
}
