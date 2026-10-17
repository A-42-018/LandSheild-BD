import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "../security-headers.mjs";

const dir = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("CSP baseline", () => {
  const prod = buildCsp({ apiUrl: "http://127.0.0.1:8001/api/v1" });

  it("locks framing, plugins, base URI and form targets", () => {
    expect(dir(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(dir(prod, "object-src")).toBe("object-src 'none'");
    expect(dir(prod, "base-uri")).toBe("base-uri 'self'");
    expect(dir(prod, "form-action")).toBe("form-action 'self'");
    expect(dir(prod, "default-src")).toBe("default-src 'self'");
  });

  it("allows only the API origin (no path) for connections, and never a wildcard", () => {
    expect(dir(prod, "connect-src")).toBe("connect-src 'self' http://127.0.0.1:8001");
    expect(prod).not.toMatch(/(^|\s)\*(\s|;|$)/);
  });

  it("keeps blob: for the document preview image and PDF frame", () => {
    expect(dir(prod, "img-src")).toContain("blob:");
    expect(dir(prod, "frame-src")).toContain("blob:");
  });

  it("allows eval and websockets only in dev", () => {
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).not.toContain("ws://");
    const dev = buildCsp({ dev: true });
    expect(dir(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dir(dev, "connect-src")).toContain("ws://localhost:*");
  });

  it("adds the optional tile server to img-src only, ignores invalid URLs", () => {
    const withTiles = buildCsp({ tileUrl: "https://tiles.example/{z}/{x}/{y}.png" });
    expect(dir(withTiles, "img-src")).toContain("https://tiles.example");
    expect(dir(withTiles, "connect-src")).not.toContain("tiles.example");
    expect(buildCsp({ tileUrl: "not a url", apiUrl: "" })).toBe(buildCsp());
  });
});

describe("securityHeaders", () => {
  const get = (h: { key: string; value: string }[], k: string) => h.find((x) => x.key === k)?.value;

  it("sets the required headers", () => {
    const h = securityHeaders({});
    expect(get(h, "X-Frame-Options")).toBe("DENY");
    expect(get(h, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(h, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get(h, "Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(get(h, "Permissions-Policy")).toContain("camera=(self)");
  });

  it("sends HSTS only for an https production site", () => {
    expect(get(securityHeaders({ siteUrl: "http://localhost:3000" }), "Strict-Transport-Security")).toBeUndefined();
    expect(get(securityHeaders({ dev: true, siteUrl: "https://x.example" }), "Strict-Transport-Security")).toBeUndefined();
    expect(get(securityHeaders({ siteUrl: "https://x.example" }), "Strict-Transport-Security")).toContain("max-age=31536000");
  });

  it("is wired into next.config.mjs and hides the framework header", () => {
    const cfg = readFileSync(resolve(process.cwd(), "next.config.mjs"), "utf8");
    expect(cfg).toContain("securityHeaders(");
    expect(cfg).toContain("poweredByHeader: false");
    expect(cfg).toContain('source: "/:path*"');
  });
});
