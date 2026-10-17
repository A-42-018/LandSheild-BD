// Security headers for every page (P51). Kept as plain .mjs so next.config.mjs can import it and
// vitest can test it. Baseline CSP: Next's App Router emits inline bootstrap scripts, so
// 'unsafe-inline' stays for scripts until a nonce middleware exists (documented in docs/security.md).

/** Default street basemap (OpenStreetMap standard tiles). Set NEXT_PUBLIC_MAP_TILE_URL to another server, or "off" for none. */
export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const originOf = (url) => {
  try {
    return url ? new URL(url).origin : undefined;
  } catch {
    return undefined;
  }
};

export function buildCsp({ dev = false, apiUrl, tileUrl } = {}) {
  const api = originOf(apiUrl);
  const tiles = originOf(tileUrl);
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"], // Next + Leaflet set inline styles
    "img-src": ["'self'", "data:", "blob:", tiles], // blob: = document preview
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", api, ...(dev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : [])],
    "frame-src": ["'self'", "blob:"], // PDF preview iframe
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, [...new Set(values.filter(Boolean))]])
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(options = {}) {
  const headers = [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // origin-only on cross-origin requests (map tile servers need a referer, nothing leaks a path)
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if (!options.dev && (options.siteUrl ?? "").startsWith("https://")) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  }
  return headers;
}
