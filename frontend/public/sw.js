/* LandShield BD service worker (U5.2).
 * Offline: only the picture-guide pages (/bn/guide, /en/guide) and what they need are kept. Nothing from the API, the
 * signed-in areas or the map is ever cached: those pages need the network, and a land record must not sit in a cache.
 * Bump VERSION to drop everything stored by an older worker. */
const VERSION = "ls-v1";
const CACHE = `${VERSION}-guide`;
const OFFLINE = "/offline.html";
const GUIDE_PAGES = ["/bn/guide", "/en/guide"];
const WAIT_MS = 4000; // a slow network gives way to the stored copy after this long

const isGuidePage = (path) => /^\/(bn|en)\/guide\/?$/.test(path);
const isAsset = (path) => /^\/(_next\/static\/|_next\/image$|guide\/(bn|en|video)\/|brand\/|icons\/)/.test(path);

/** Same-origin assets a guide page needs (scripts, styles, step pictures, poster frames). Videos are left out: 3 MB each, and they only load on play. */
function assetUrls(html) {
  const out = new Set();
  for (const m of html.matchAll(/\b(?:src|href|poster|srcset)="([^"]+)"/gi)) {
    for (const part of m[1].replace(/&amp;/g, "&").split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith("/") && !u.startsWith("//") && isAsset(u.split("?")[0]) && !/\.(mp4|vtt)$/.test(u)) out.add(u);
    }
  }
  return [...out];
}

/** Fonts are named in the stylesheets, not the page. */
function cssFontUrls(css) {
  return [...css.matchAll(/url\(\s*["']?(\/_next\/static\/media\/[^)"']+)/g)].map((m) => m[1]);
}

async function keep(cache, url) {
  if (await cache.match(url)) return;
  const res = await fetch(url);
  if (!res.ok) return;
  await cache.put(url, res.clone());
  if (url.split("?")[0].endsWith(".css")) await Promise.allSettled(cssFontUrls(await res.text()).map((f) => keep(cache, f)));
}

/** Stores a guide page and everything it references, so the next offline visit is complete. */
async function storeGuide(cache, request, response) {
  await cache.put(request, response.clone());
  const html = await response.text();
  await Promise.allSettled(assetUrls(html).map((u) => keep(cache, u)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled([
        keep(cache, OFFLINE),
        ...GUIDE_PAGES.map(async (p) => {
          const res = await fetch(p, { cache: "reload" });
          if (res.ok) await storeGuide(cache, p, res);
        }),
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("ls-v") && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

async function navigate(request, url) {
  const cache = await caches.open(CACHE);
  const guide = isGuidePage(url.pathname);
  try {
    const network = fetch(request).then(async (res) => {
      if (guide && res.ok) await storeGuide(cache, url.pathname, res.clone());
      return res;
    });
    const stored = guide ? await cache.match(url.pathname) : undefined;
    if (!stored) return await network;
    // network first; the stored copy answers when the network fails or is slower than WAIT_MS
    return await Promise.race([network, new Promise((_, no) => setTimeout(() => no(new Error("slow")), WAIT_MS))]).catch(() => stored);
  } catch {
    return (guide && (await cache.match(url.pathname))) || (await cache.match(OFFLINE)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
  } else if (isAsset(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});

self.lsSw = { assetUrls, cssFontUrls, isGuidePage, isAsset };
