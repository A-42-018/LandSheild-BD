/** Public QR target: /{locale}/v/{landId}[?d=&h=] (signature check only; no tokens or names). */
export function publicPath(locale: string, landId: string): string {
  return `/${locale}/v/${encodeURIComponent(landId)}`;
}

export interface Seal {
  deedId: string;
  hash12: string;
}

/** Signed QR adds only a random deed id + 12-char hash prefix (F4a): still no names or tokens. */
export function publicUrl(locale: string, landId: string, origin?: string, seal?: Seal | null): string {
  const base = (
    origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/$/, "");
  const q = seal ? `?d=${encodeURIComponent(seal.deedId)}&h=${encodeURIComponent(seal.hash12)}` : "";
  return `${base}${publicPath(locale, landId)}${q}`;
}
