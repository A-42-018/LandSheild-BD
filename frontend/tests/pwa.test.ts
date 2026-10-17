import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLOR } from "../lib/theme";
import manifest from "../app/manifest";

/** Loads public/sw.js with a fake worker scope and returns what it registered. */
function loadWorker() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = { addEventListener: (n: string, f: (e: unknown) => void) => (listeners[n] = f), location: { origin: "https://x.test" } } as Record<string, unknown>;
  new Function("self", "caches", "fetch", readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8"))(self, {}, () => {});
  return { listeners, api: self.lsSw as Record<string, (...a: never[]) => unknown> };
}

describe("PWA (U5.2)", () => {
  it("manifest is installable: name, standalone, start page, 192 + 512 + maskable icons that exist", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/bn");
    expect(m.theme_color).toBe(BRAND_COLOR);
    const sizes = m.icons!.map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(m.icons!.some((i) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons!) expect(() => readFileSync(resolve(process.cwd(), "public", i.src.slice(1)))).not.toThrow();
  });

  it("the worker handles install, activate and fetch", () => {
    const { listeners } = loadWorker();
    expect(Object.keys(listeners).sort()).toEqual(["activate", "fetch", "install"]);
  });

  it("keeps only guide pages: never the API, signed-in areas, the map or results", () => {
    const { api } = loadWorker();
    const guide = api.isGuidePage as (p: string) => boolean;
    expect(["/bn/guide", "/en/guide", "/bn/guide/"].every(guide)).toBe(true);
    expect(["/bn", "/bn/verify/result", "/bn/my", "/bn/map", "/bn/guides", "/fr/guide", "/api/v1/lands/LP-1"].some(guide)).toBe(false);
  });

  it("finds a guide page's scripts, styles, pictures and posters, but not videos or links to other pages", () => {
    const { api } = loadWorker();
    const html = `
      <link rel="stylesheet" href="/_next/static/css/a1.css"/>
      <script src="/_next/static/chunks/main-b2.js" async=""></script>
      <a href="/bn/verify">try</a>
      <img src="/guide/bn/verify-s1.webp" srcset="/guide/bn/verify-s1.webp 1x, /guide/bn/verify-s1-2x.webp 2x"/>
      <video poster="/guide/video/verify.webp"><source src="/guide/video/verify.mp4" type="video/mp4"/><track src="/guide/video/verify.bn.vtt"/></video>
      <img src="https://cdn.example/x.png"/><img src="//evil.test/y.png"/>
      <img src="/_next/image?url=%2Fa.webp&amp;w=64&amp;q=75"/>`;
    expect((api.assetUrls as (h: string) => string[])(html).sort()).toEqual(
      [
        "/_next/image?url=%2Fa.webp&w=64&q=75",
        "/_next/static/chunks/main-b2.js",
        "/_next/static/css/a1.css",
        "/guide/video/verify.webp",
        "/guide/bn/verify-s1-2x.webp",
        "/guide/bn/verify-s1.webp",
      ].sort(),
    );
  });

  it("finds the fonts a stylesheet names", () => {
    const { api } = loadWorker();
    const css = `@font-face{src:url(/_next/static/media/a.woff2) format("woff2")}@font-face{src:url("/_next/static/media/b.woff2")}.x{background:url(/img/x.png)}`;
    expect((api.cssFontUrls as (c: string) => string[])(css)).toEqual(["/_next/static/media/a.woff2", "/_next/static/media/b.woff2"]);
  });
});
