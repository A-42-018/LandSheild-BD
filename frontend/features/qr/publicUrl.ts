/** Public QR target: /{locale}/v/{landId} only (no tokens, names or query data). */
export function publicPath(locale: string, landId: string): string {
  return `/${locale}/v/${encodeURIComponent(landId)}`;
}

export function publicUrl(locale: string, landId: string, origin?: string): string {
  const base = (
    origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/$/, "");
  return `${base}${publicPath(locale, landId)}`;
}
