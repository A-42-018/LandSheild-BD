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

/** "24° 07′ 41″ N 91° 20′ 04″ E" (readout under the map, as on the reference portal). */
export function formatCoords(lat: number, lng: number): string {
  return `${dms(lat, "N", "S")} ${dms(lng, "E", "W")}`;
}

export function formatZoom(z: number): string {
  return z.toFixed(2);
}
