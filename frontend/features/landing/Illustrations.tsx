/** Decorative 3D-style illustrations for the landing service cards. Pure inline SVG (no image files), aria-hidden.
 *  Gradient/filter ids are prefixed per illustration; each one is rendered once on the page. */
import type { ReactNode } from "react";

function Art({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 140 112" aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  );
}

const Blur = ({ id }: { id: string }) => (
  <filter id={id} x="-50%" y="-200%" width="200%" height="500%">
    <feGaussianBlur stdDeviation="3" />
  </filter>
);
const Shadow = ({ id, cx, cy, rx }: { id: string; cx: number; cy: number; rx: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={5} fill="#0E1F36" opacity="0.2" filter={`url(#${id})`} />
);

/** Map pin with its tip at (x, y); s = head radius. */
const pin = (x: number, y: number, s: number) =>
  `M${x},${y}C${x - 0.35 * s},${y - 0.6 * s} ${x - s},${y - 1.05 * s} ${x - s},${y - 1.6 * s}A${s},${s} 0 1 1 ${x + s},${y - 1.6 * s}C${x + s},${y - 1.05 * s} ${x + 0.35 * s},${y - 0.6 * s} ${x},${y}Z`;

/** Scalloped seal edge: 18 bumps between radius r and r - 1.6. */
const scallop = (cx: number, cy: number, r: number) =>
  Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const rr = i % 2 ? r - 1.6 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }).join(" ");

/** 3D coin/node: side band plus top face. */
function Disk({ cx, cy, r = 14, top, rim, side }: { cx: number; cy: number; r?: number; top: string; rim: string; side: string }) {
  const ry = r * 0.42;
  return (
    <g>
      <path d={`M${cx - r},${cy}V${cy + 6}A${r},${ry} 0 0 0 ${cx + r},${cy + 6}V${cy}Z`} fill={side} />
      <ellipse cx={cx} cy={cy} rx={r} ry={ry} fill={rim} />
      <ellipse cx={cx} cy={cy} rx={r * 0.72} ry={ry * 0.7} fill={top} />
    </g>
  );
}

/** Verify land record: an isometric plot map under a magnifier holding a shield. */
export function PlotSearchArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <defs>
        <Blur id="pa-b" />
        <linearGradient id="pa-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9BDAB0" /><stop offset="1" stopColor="#3E9E6A" /></linearGradient>
        <linearGradient id="pa-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F7DC8E" /><stop offset="1" stopColor="#B8860B" /></linearGradient>
        <radialGradient id="pa-glass" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" /><stop offset="1" stopColor="#BFE3F2" stopOpacity="0.55" /></radialGradient>
        <linearGradient id="pa-sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22B07D" /><stop offset="1" stopColor="#00563F" /></linearGradient>
      </defs>
      <Shadow id="pa-b" cx={72} cy={104} rx={58} />
      {/* slab sides */}
      <path d="M8,70L74,98V106L8,78Z" fill="#245F3F" />
      <path d="M74,98L132,70V78L74,106Z" fill="#2E7550" />
      {/* top face + parcels */}
      <path d="M8,70L66,44L132,70L74,98Z" fill="url(#pa-top)" />
      <path d="M48.6,51.8L66,44L92.4,55.2L75,63Z" fill="#D3EC97" opacity="0.85" />
      <path d="M57.5,91L77.8,81.9L94.3,88.9L74,98Z" fill="#E9C46A" opacity="0.8" />
      <path d="M28.3,60.9L94.3,88.9M48.6,51.8L114.6,79.8M57.5,91L115.5,65" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1" />
      <path d="M34.4,81.2L92.4,55.2" stroke="#EADBB0" strokeWidth="3.5" strokeLinecap="round" />
      <g fill="#1E6B44"><circle cx="24" cy="70" r="2.6" /><circle cx="30" cy="73" r="2.2" /><circle cx="104" cy="82" r="2.6" /><circle cx="110" cy="79" r="2" /></g>
      {/* magnifier */}
      <path d="M96,53L114,71" stroke="#5B3A1E" strokeWidth="8" strokeLinecap="round" />
      <path d="M99,56L112,69" stroke="#8C5E33" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M94,51L99,56" stroke="url(#pa-ring)" strokeWidth="9" strokeLinecap="round" />
      <circle cx="80" cy="36" r="24" fill="url(#pa-glass)" />
      <path d="M80,23L92,27.5V37C92,44.5 86.5,49.5 80,52C73.5,49.5 68,44.5 68,37V27.5Z" fill="url(#pa-sh)" />
      <path d="M80,23L92,27.5V37C92,44.5 86.5,49.5 80,52Z" fill="#FFFFFF" opacity="0.14" />
      <path d="M74.5,37.5L78.5,41.5L86,33.5" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="80" cy="36" r="24" fill="none" stroke="url(#pa-ring)" strokeWidth="6" />
      <circle cx="80" cy="36" r="20.6" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" />
      <path d="M64,31A17,17 0 0 1 73,20" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
    </Art>
  );
}

/** Check before you buy: a clipboard checklist with a gold seal. */
export function ChecklistArt({ className }: { className?: string }) {
  const rows = [32, 48, 64];
  return (
    <Art className={className}>
      <defs>
        <Blur id="ca-b" />
        <linearGradient id="ca-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34496F" /><stop offset="1" stopColor="#14223B" /></linearGradient>
        <linearGradient id="ca-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#EAEFF5" /></linearGradient>
        <linearGradient id="ca-clip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EEF2F6" /><stop offset="1" stopColor="#97A3B3" /></linearGradient>
        <radialGradient id="ca-gold" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFE9A3" /><stop offset="1" stopColor="#C38E17" /></radialGradient>
      </defs>
      <Shadow id="ca-b" cx={72} cy={104} rx={42} />
      <rect x="37" y="13" width="62" height="88" rx="7" fill="#0B1526" />
      <rect x="34" y="10" width="62" height="88" rx="7" fill="url(#ca-board)" />
      <rect x="40" y="20" width="50" height="72" rx="3" fill="url(#ca-paper)" />
      <rect x="52" y="5" width="26" height="12" rx="3" fill="url(#ca-clip)" />
      <circle cx="65" cy="9.5" r="2" fill="#14223B" />
      {rows.map((y) => (
        <g key={y}>
          <rect x="45" y={y - 5} width="10" height="10" rx="2" fill="#E6F2ED" stroke="#0F7F61" strokeWidth="1.2" />
          <path d={`M47.4,${y}L49.6,${y + 2.4}L53.2,${y - 2.6}`} fill="none" stroke="#0F7F61" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="59" y={y - 3.5} width="26" height="2.6" rx="1.3" fill="#C2CCD8" />
          <rect x="59" y={y + 1} width="17" height="2.2" rx="1.1" fill="#DCE2EA" />
        </g>
      ))}
      <rect x="45" y="78" width="40" height="2.4" rx="1.2" fill="#DCE2EA" />
      <rect x="45" y="83" width="28" height="2.4" rx="1.2" fill="#DCE2EA" />
      {/* seal */}
      <path d="M92,86L86,104L92,100.5L95.5,106L99,90Z" fill="#C08A16" />
      <path d="M104,86L110,104L104,100.5L100.5,106L97,90Z" fill="#9E6C0C" />
      <polygon points={scallop(98, 80, 15)} fill="url(#ca-gold)" />
      <circle cx="98" cy="80" r="10.5" fill="none" stroke="#FFF4C9" strokeOpacity="0.85" />
      <path d="M93.5,80L96.8,83.3L102.8,77" fill="none" stroke="#8A5E08" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Art>
  );
}

/** Track mutation: application stages as connected 3D nodes with location pins. */
export function RouteArt({ className }: { className?: string }) {
  const goldSide = "#9C6B12";
  return (
    <Art className={className}>
      <defs>
        <Blur id="ra-b" />
        <linearGradient id="ra-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE29A" /><stop offset="1" stopColor="#C8921C" /></linearGradient>
        <linearGradient id="ra-green" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3FBF8A" /><stop offset="1" stopColor="#0B6B4C" /></linearGradient>
      </defs>
      <Shadow id="ra-b" cx={34} cy={66} rx={16} />
      <Shadow id="ra-b" cx={30} cy={100} rx={16} />
      <Shadow id="ra-b" cx={74} cy={86} rx={16} />
      <Shadow id="ra-b" cx={112} cy={104} rx={16} />
      <path d="M34,58L74,80M30,92L74,80M74,80L112,96" stroke="#3F4A5C" strokeWidth="4" strokeLinecap="round" />
      <path d="M34,58L74,80M30,92L74,80M74,80L112,96" stroke="#9AA6B8" strokeWidth="1.4" strokeLinecap="round" />
      {/* gold coin stack + pin */}
      <Disk cx={34} cy={60} top="#E8B847" rim="url(#ra-gold)" side={goldSide} />
      <Disk cx={34} cy={53} top="#E8B847" rim="url(#ra-gold)" side={goldSide} />
      <path d={pin(34, 50, 9)} fill="url(#ra-gold)" stroke="#9C6B12" strokeWidth="0.8" />
      <circle cx="34" cy="35.6" r="3.8" fill="#FFF6D6" />
      {/* green nodes */}
      <Disk cx={30} cy={92} top="#2F8C6F" rim="url(#ra-gold)" side={goldSide} />
      <Disk cx={74} cy={80} top="#2F8C6F" rim="url(#ra-gold)" side={goldSide} />
      <Disk cx={112} cy={96} top="#2F8C6F" rim="url(#ra-gold)" side={goldSide} />
      <path d={pin(76, 74, 13)} fill="url(#ra-green)" stroke="#064A34" strokeWidth="0.8" />
      <circle cx="76" cy="53.2" r="5.4" fill="#E6F2ED" />
      <path d="M68,48A9,9 0 0 1 74,43" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
    </Art>
  );
}

const QR = ["1110111", "1010101", "1110111", "0001000", "1101011", "0110110", "1011101"];

/** Verify a document copy: a deed with a QR code, rosette and padlock. */
export function DeedArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <defs>
        <Blur id="da-b" />
        <linearGradient id="da-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E6ECF3" /></linearGradient>
        <radialGradient id="da-blue" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#B7D4FA" /><stop offset="1" stopColor="#2F5FB3" /></radialGradient>
        <linearGradient id="da-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE29A" /><stop offset="1" stopColor="#B9840F" /></linearGradient>
      </defs>
      <Shadow id="da-b" cx={70} cy={104} rx={42} />
      <rect x="44" y="10" width="58" height="84" rx="3" fill="#D6DEE8" transform="rotate(7 73 52)" />
      <path d="M34,8H86L98,20V96H34Z" fill="url(#da-paper)" stroke="#C3CDD9" strokeWidth="0.8" />
      <path d="M86,8V20H98Z" fill="#C9D3DF" />
      {/* title bar instead of a word, so the drawing reads the same in English and Bangla */}
      <rect x="50" y="18" width="28" height="5" rx="1.5" fill="#1F2D44" />
      <rect x="46" y="26" width="36" height="1.4" rx="0.7" fill="#8C99AB" />
      <g fill="#B8C3D1">
        <rect x="42" y="33" width="46" height="2" rx="1" /><rect x="42" y="38.5" width="40" height="2" rx="1" />
        <rect x="42" y="44" width="46" height="2" rx="1" /><rect x="42" y="49.5" width="30" height="2" rx="1" />
      </g>
      <rect x="66" y="57" width="25" height="25" rx="1.5" fill="#FFFFFF" stroke="#C3CDD9" strokeWidth="0.6" />
      <g fill="#14223B">
        {QR.flatMap((row, y) => [...row].map((b, x) => (b === "1" ? <rect key={`${x}-${y}`} x={68 + x * 3} y={59 + y * 3} width="3" height="3" /> : null)))}
      </g>
      {/* rosette */}
      <path d="M40,82L36,98L41,95L44,100L46,86Z" fill="#2A4F94" />
      <path d="M52,82L56,98L51,95L48,100L46,86Z" fill="#1E3C75" />
      <polygon points={scallop(46, 77, 11)} fill="url(#da-blue)" />
      <circle cx="46" cy="77" r="7.2" fill="none" stroke="#E4EEFD" strokeOpacity="0.9" />
      {/* padlock */}
      <path d="M93,86V81A7,7 0 0 1 107,81V86" fill="none" stroke="#8A6A1C" strokeWidth="3.2" />
      <rect x="89" y="85" width="22" height="17" rx="3" fill="url(#da-gold)" stroke="#8A6A1C" strokeWidth="0.8" />
      <circle cx="100" cy="91.5" r="2.2" fill="#5E4409" />
      <rect x="99.1" y="92.5" width="1.8" height="5" rx="0.9" fill="#5E4409" />
    </Art>
  );
}

/** Land unit converter: a gridded isometric plot with a measured parcel and a tape measure. */
export function TapeMeasureArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <defs>
        <Blur id="ua-b" />
        <linearGradient id="ua-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B7E4C4" /><stop offset="1" stopColor="#4FAE7A" /></linearGradient>
        <linearGradient id="ua-case" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFD86B" /><stop offset="1" stopColor="#E09A12" /></linearGradient>
      </defs>
      <Shadow id="ua-b" cx={68} cy={106} rx={58} />
      <path d="M8,74L74,100V108L8,82Z" fill="#2A6B47" />
      <path d="M74,100L128,74V82L74,108Z" fill="#348457" />
      <path d="M8,74L62,50L128,74L74,100Z" fill="url(#ua-top)" />
      <path d="M48,74.7L66,66.7L88,75.3L70,83.3Z" fill="#F2D27A" opacity="0.9" />
      <path d="M48,74.7L66,66.7L88,75.3L70,83.3Z" fill="none" stroke="#B8860B" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d="M26,66L92,92M44,58L110,84M30,82.7L84,58.7M52,91.3L106,67.3" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1" />
      {/* tape */}
      <path d="M14,77L80,47" stroke="#F2C94C" strokeWidth="7" strokeLinecap="round" />
      <path d="M14,77L80,47" stroke="#7A5A00" strokeWidth="3.5" strokeDasharray="0.8 4.2" />
      <path d="M12,74.5L16,80" stroke="#7A5A00" strokeWidth="2" strokeLinecap="round" />
      {/* case */}
      <rect x="77" y="20" width="36" height="34" rx="10" fill="#9C6510" />
      <rect x="74" y="17" width="36" height="34" rx="10" fill="url(#ua-case)" />
      <circle cx="92" cy="34" r="9.5" fill="#3A2A08" />
      <circle cx="92" cy="34" r="6.5" fill="#F5E2A8" />
      <circle cx="92" cy="34" r="2.2" fill="#3A2A08" />
      <rect x="99" y="13" width="9" height="6" rx="2" fill="#2E3A4E" />
      <path d="M79,24A12,12 0 0 1 88,19.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" />
    </Art>
  );
}

/** Registration and mutation fee calculator: a calculator with a banknote and a coin stack. */
export function FeeCalculatorArt({ className }: { className?: string }) {
  const keys = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ x: 47 + c * 12, y: 42 + r * 11 })));
  const goldSide = "#9C6B12";
  return (
    <Art className={className}>
      <defs>
        <Blur id="fa-b" />
        <linearGradient id="fa-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34496F" /><stop offset="1" stopColor="#14223B" /></linearGradient>
        <linearGradient id="fa-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE29A" /><stop offset="1" stopColor="#C8921C" /></linearGradient>
        <linearGradient id="fa-note" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A6DDB8" /><stop offset="1" stopColor="#4FA875" /></linearGradient>
      </defs>
      <Shadow id="fa-b" cx={70} cy={104} rx={46} />
      <g transform="rotate(-14 40 60)">
        <rect x="14" y="46" width="48" height="28" rx="3" fill="url(#fa-note)" stroke="#2F7D52" strokeWidth="0.8" />
        <rect x="18" y="50" width="40" height="20" rx="2" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" />
        <circle cx="38" cy="60" r="6" fill="#2F7D52" opacity="0.55" />
      </g>
      <rect x="43" y="11" width="52" height="84" rx="8" fill="#0B1526" />
      <rect x="40" y="8" width="52" height="84" rx="8" fill="url(#fa-body)" />
      <rect x="46" y="15" width="40" height="18" rx="3" fill="#CFEBD9" />
      <rect x="62" y="21" width="20" height="3" rx="1.5" fill="#2F6B4F" /><rect x="70" y="26.5" width="12" height="3" rx="1.5" fill="#2F6B4F" />
      {keys.map(({ x, y }) => <rect key={`${x}-${y}`} x={x} y={y} width="9" height="8" rx="2" fill="#E3E9F1" />)}
      <rect x="47" y="75" width="21" height="8" rx="2" fill="#E3E9F1" />
      <rect x="71" y="75" width="9" height="8" rx="2" fill="url(#fa-gold)" />
      <path d="M44,16A6,6 0 0 1 49,11" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      {/* coin stack */}
      <Disk cx={108} cy={92} r={13} top="#E8B847" rim="url(#fa-gold)" side={goldSide} />
      <Disk cx={108} cy={85} r={13} top="#E8B847" rim="url(#fa-gold)" side={goldSide} />
      <Disk cx={108} cy={78} r={13} top="#E8B847" rim="url(#fa-gold)" side={goldSide} />
    </Art>
  );
}

/** Inheritance share calculator: a balance scale holding a house and a share of a pie. */
export function ScaleArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <defs>
        <Blur id="sa-b" />
        <linearGradient id="sa-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FBE29A" /><stop offset="1" stopColor="#B9840F" /></linearGradient>
        <linearGradient id="sa-pan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F5D27A" /><stop offset="1" stopColor="#A87410" /></linearGradient>
      </defs>
      <Shadow id="sa-b" cx={70} cy={104} rx={44} />
      <g transform="translate(-9 -8) scale(1.13)">
      <path d="M52,102H88L82,93H58Z" fill="#9E6C0C" />
      <rect x="54" y="99" width="32" height="4" rx="2" fill="#7E560A" />
      <rect x="66" y="22" width="8" height="72" rx="2.5" fill="url(#sa-gold)" />
      <path d="M26,32L114,32" stroke="url(#sa-gold)" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="70" cy="21" r="5.5" fill="url(#sa-gold)" stroke="#9E6C0C" strokeWidth="0.8" />
      <path d="M30,34L20,66M30,34L40,66M110,34L100,66M110,34L120,66" stroke="#8A6A1C" strokeWidth="1.6" />
      {/* left pan: house */}
      <path d="M23,55H37V65H23Z" fill="#F4F7FA" stroke="#C3CDD9" strokeWidth="0.6" />
      <path d="M21,56L30,47L39,56Z" fill="#2F8C6F" />
      <rect x="28" y="59" width="4" height="6" fill="#2F6B4F" />
      {/* right pan: pie share */}
      <circle cx="110" cy="57" r="8" fill="#2F8C6F" />
      <path d="M110,57L110,49A8,8 0 0 1 117.6,59.5Z" fill="#E9C46A" />
      <path d="M14,66H46A16,8 0 0 1 14,66Z" fill="url(#sa-pan)" />
      <path d="M94,66H126A16,8 0 0 1 94,66Z" fill="url(#sa-pan)" />
      <path d="M14,66H46M94,66H126" stroke="#FFF1C2" strokeOpacity="0.8" strokeWidth="1.2" />
      </g>
    </Art>
  );
}

/** Sign-in panel mark: a glassy 3D shield with a check, for use on the deep green auth panel. */
export function ShieldArt({ className }: { className?: string }) {
  const outer = "M40,6L70,16V42C70,62 56,76 40,84C24,76 10,62 10,42V16Z";
  const inner = "M40,13L64,21V42C64,58 53,69 40,76C27,69 16,58 16,42V21Z";
  return (
    <svg viewBox="0 0 80 92" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id="sh-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FE0B0" /><stop offset="1" stopColor="#13865B" /></linearGradient>
        <linearGradient id="sh-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" /></linearGradient>
        <filter id="sh-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <ellipse cx="42" cy="88" rx="22" ry="3" fill="#000000" opacity="0.3" filter="url(#sh-blur)" />
      <path d={outer} transform="translate(3 3)" fill="#0A4A33" />
      <path d={outer} fill="url(#sh-face)" />
      <path d={inner} fill="url(#sh-in)" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M40,6L70,16V42C70,62 56,76 40,84Z" fill="#000000" opacity="0.08" />
      <path d="M28,44L37,53L54,34" fill="none" stroke="#0A4A33" strokeOpacity="0.35" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" transform="translate(1 2)" />
      <path d="M28,44L37,53L54,34" fill="none" stroke="#FFFFFF" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19,24L38,17.5" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export const SERVICE_ART = { verify: PlotSearchArt, check: ChecklistArt, track: RouteArt, verifyDoc: DeedArt } as const;
export const TOOL_ART = { units: TapeMeasureArt, fees: FeeCalculatorArt, faraid: ScaleArt } as const;
