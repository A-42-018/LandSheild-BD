/** Village → town → land office → mobile tower silhouette (U1.8, roadmap P14): it stands on the footer's gold top line and
 *  quietly tells the "rural to digital" story. Original artwork; decoration only, so it is hidden from assistive tech and print. */

/** Paddy tufts along the ground from x0 to x1. */
const paddy = (x0: number, x1: number) =>
  Array.from({ length: Math.floor((x1 - x0) / 12) }, (_, i) => `M${x0 + i * 12},90l3,-8l1,8l2,-10l2,10l1,-8l3,8Z`).join("");
/** Filled circle as a path. */
const dot = (cx: number, cy: number, r: number) => `M${cx - r},${cy}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 ${-r * 2},0Z`;
/** Row of lit windows: n windows of size w×h starting at (x, y), step dx. */
const windows = (x: number, y: number, n: number, dx: number, w = 6, h = 8) =>
  Array.from({ length: n }, (_, i) => `M${x + i * dx},${y}h${w}v${h}h${-w}Z`).join("");

/** Distant tree line and skyline, drawn lighter behind the main silhouette. */
const BACK =
  "M0,90V80Q60,66 120,76T240,72T360,78T480,70T600,78H630V64H650V70H700V50H730V62H790V56H830V46H860V60H940V52H990V90Z" +
  "M1000,90V70H1270V58H1300V90ZM1370,90V52H1400V66H1440V90Z";

const FRONT = [
  paddy(4, 184),
  // hut 1 and hut 2: walls and curved thatch roofs
  "M196,90V70H244V90ZM186,72Q220,44 254,72Z",
  "M318,90V74H356V90ZM308,76Q337,52 366,76Z",
  // coconut palm
  "M268,90Q272,60 280,40L284,41Q277,62 274,90ZM282,40q-20,-6 -30,8q14,-10 30,-6ZM282,40q20,-8 32,6q-14,-8 -32,-4ZM282,40q-8,-16 -26,-14q16,2 26,14ZM282,40q10,-16 28,-12q-16,0 -28,12Z",
  // nouka with a chhoi (cabin) and the boatman's pole
  "M388,86Q440,100 496,84L490,77Q440,90 394,79ZM418,84Q440,64 464,84ZM470,84L488,54L490,55L474,85Z",
  // banyan tree with aerial roots
  "M516,72a16,16 0 0 1 10,-26a22,22 0 0 1 40,-8a20,20 0 0 1 34,14a14,14 0 0 1 -4,22ZM552,90V70H564V90ZM536,90V72h2V90ZM578,90V72h2V90Z",
  // town: low blocks, a rooftop water tank, a rickshaw and a street tree
  "M620,90V58H668V90ZM674,90V40H714V90ZM686,40V30H702V40ZM720,90V64H776V90Z",
  // cycle rickshaw: rider, frame, folding hood and seat
  dot(784, 86, 4) + dot(822, 84, 6) + dot(790, 60, 3) + "M788,64H792L796,78L792,80ZM784,86L794,80L796,82L786,88ZM794,80H830V84H794Z" +
    "M808,80Q812,58 832,62L834,80Z",
  "M850,90V34H896V90ZM902,90V54H944V90Z" + dot(964, 62, 15) + "M962,90V72h4V90Z",
  // land office: steps, columned block, cornice and pediment
  "M1000,90V84H1260V90ZM1010,84V80H1250V84ZM1024,80V46H1236V80ZM1018,47V40H1242V47ZM1094,40L1130,22L1166,40Z",
  // digital: small modern blocks and a mobile tower
  "M1286,90V70H1316V90ZM1330,90L1344,30H1348L1362,90H1356L1346,44L1336,90ZM1338,72H1354V75H1338ZM1341,56H1351V59H1341Z" +
    dot(1346, 28, 3),
  "M1380,90V60H1420V90Z",
].join("");

/** Gold details: lit windows in the town and the office, the office door, and the tower's signal arcs (stroked). */
const LIGHTS =
  windows(628, 64, 3, 14) + windows(682, 48, 3, 11, 5, 7) + windows(682, 64, 3, 11, 5, 7) + windows(728, 70, 4, 12) +
  windows(858, 42, 3, 13) + windows(858, 58, 3, 13) + windows(908, 62, 3, 12) +
  windows(1036, 52, 7, 13, 5, 20) + windows(1146, 52, 7, 13, 5, 20) + "M1122,80V56h16V80Z" +
  windows(1388, 66, 3, 10, 5, 7);
const SIGNAL = "M1336,20a14,14 0 0 1 20,0M1330,14a22,22 0 0 1 32,0";

export default function SkylineStrip() {
  return (
    <div aria-hidden="true" data-testid="skyline-strip" className="pointer-events-none mt-12 select-none print:hidden">
      <svg className="mx-auto block h-auto w-full max-w-[75rem]" viewBox="0 0 1440 90" preserveAspectRatio="xMidYMax meet">
        <path d={BACK} fill="rgb(var(--primary) / 0.16)" />
        <path d={FRONT} fill="rgb(var(--skyline))" />
        <path d={LIGHTS} fill="rgb(var(--gold) / 0.8)" />
        <path d={SIGNAL} fill="none" stroke="rgb(var(--gold))" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
