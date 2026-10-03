export interface SecurityHeaderOptions {
  dev?: boolean;
  apiUrl?: string;
  tileUrl?: string;
  siteUrl?: string;
}
export function buildCsp(options?: SecurityHeaderOptions): string;
export function securityHeaders(options?: SecurityHeaderOptions): { key: string; value: string }[];
export const DEFAULT_TILE_URL: string;
