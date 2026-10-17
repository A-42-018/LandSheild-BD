function dms(value: number, pos: string, neg: string): string {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  // carry when rounding gives 60"
  const [dd, mm, ss] = s === 60 ? (m === 59 ? [d + 1, 0, 0] : [d, m + 1, 0]) : [d, m, s];
  return `${dd}° ${String(mm).padStart(2, "0")}′ ${String(ss).padStart(2, "0")}″ ${value >= 0 ? pos : neg}`;
}

/** Hemisphere words for the readout; English uses the compass letters. */
export interface Hemispheres {
  n: string;
  s: string;
  e: string;
  w: string;
}
const COMPASS: Hemispheres = { n: "N", s: "S", e: "E", w: "W" };

/** "24° 07′ 41″ N 91° 20′ 04″ E" (readout under the map, as on the reference portal). ASCII digits; callers localise. */
export function formatCoords(lat: number, lng: number, h: Hemispheres = COMPASS): string {
  return `${dms(lat, h.n, h.s)} ${dms(lng, h.e, h.w)}`;
}

export function formatZoom(z: number): string {
  return z.toFixed(2);
}
