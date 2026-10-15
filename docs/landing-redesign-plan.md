# Landing page redesign plan — "Soft map + glass cards"

Goal: replace the flat, bordered landing page with a friendlier, modern look (reference: the inspiration mock-up) while keeping
everything that already works — same routes, same i18n keys, same accessibility rules, same light/dark tokens.

## 1. Design direction

| Element | Before | After |
|---|---|---|
| Page background | One flat grey (`surface-muted`) | Faint topographic contours + mouza-style plot grid, two soft colour glows, fading out down the page |
| Hero | 30 px H1, short intro | Larger H1 (≈ 42 px desktop), tighter tracking, roomier spacing; still no buttons/form (tests require that) |
| Service tiles | 4 small bordered boxes, auto grid | 2 × 2 "frosted glass" cards: translucent surface, light green tint, soft lifted shadow, 14 px radius |
| Card art | Lucide icon only | Icon + a 3D-style illustration per service (plot + magnifier, checklist + seal, route nodes + pins, deed + QR + lock) |
| Hover | Border/background colour swap | Card lifts 3 px, shadow deepens, illustration rises slightly, arrow slides in |
| Other sections | Plain rows / bordered boxes | Same glass cards; icons in tinted "icon tiles"; How-it-works uses gradient step circles on a dashed connector |

Principles: calm and official (government-service feel, Formal Green brand), decoration never carries meaning,
everything works in English and Bangla, light and dark, phone to desktop.

## 2. Phase 1 — Visual refresh (done in this change)

Files:

- `frontend/features/landing/Backdrop.tsx` — new. Decorative, `aria-hidden`, `pointer-events-none`, `print:hidden`.
  Contour paths are generated deterministically at module load (no randomness → no hydration mismatch). Colours use theme
  tokens (`--primary`, `--ink`, `--accent`), so dark mode works automatically. Faded with a CSS mask.
- `frontend/features/landing/Illustrations.tsx` — new. Four inline-SVG illustrations (no image files, ≈ 2 KB each gzipped),
  gradients for depth, blurred ellipse ground shadows. No words inside the drawings, so they read the same in BN.
- `frontend/app/globals.css` — new component classes `.glass-card`, `.glass-card-link` (hover lift) and `.icon-tile`,
  with a dark-mode override. Reduced-motion users get no lift animation (existing global rule).
- `frontend/features/landing/Hero.tsx` — larger heading and spacing.
- `frontend/features/landing/Sections.tsx` — all sections moved to glass cards / icon tiles; service cards get illustrations.
- `frontend/app/[locale]/page.tsx` — renders `<Backdrop />` first.

Kept unchanged: section order, `data-testid`s, heading levels, link targets, translation keys, focus outlines.

Verified: vitest landing suite, `tsc --noEmit`, `check:i18n` (parity + hard-coded text audit), visual check at 1280 px and
375 px, EN + BN, light + dark, no horizontal scroll.

## 3. Phase 2 — Polish and consistency

1. **Header match** — slightly translucent green header with a subtle bottom shadow instead of the gold rule; pill-style
   EN/BN switch (already close); keep 44 px touch targets.
2. **Hero accent** — optional small badge above the H1 ("Demo · synthetic data") using the existing `landing.trust.demo`
   wording, so the prototype status is visible without a banner.
3. **Section rhythm** — alternate a very light tinted band behind "What we check" and "Trust" (glass on tint) to break the
   long scroll; keep the thin rule elsewhere.
4. **Notice board** — show the newest notice larger (featured card) and the rest as a compact list.
5. **Footer** — add the logo mark and a one-line mission statement; soften the gold top rule.
6. **Reuse** — use `.glass-card` on `/services`, `/tools` and `/check` landing-style pages so the inner pages match.

## 4. Phase 3 — Motion and delight (all behind `prefers-reduced-motion`)

1. Cards fade/slide in on first scroll into view (IntersectionObserver, one small client component; no animation library).
2. How-it-works connector draws left → right when visible.
3. Illustration micro-motion on hover (pin bounce, magnifier tilt) via CSS transforms only.

## 5. Phase 4 — Quality gates

| Area | Check | Target |
|---|---|---|
| Contrast | `ink`/`ink-muted` text on the translucent card over the backdrop, both themes | ≥ 4.5 : 1 (record in `docs/ui.md`) |
| Accessibility | axe-core on `/en` and `/bn`; keyboard tab order through the four cards; visible focus ring | 0 serious issues |
| Performance | Lighthouse mobile on `/en` | LCP < 2.5 s, CLS < 0.05, no new network requests (art is inline) |
| Responsive | 320, 375, 768, 1024, 1280, 1440 px; BN longest strings | No overflow, text never under the illustration |
| Print | Backdrop and shadows hidden | Clean A4 |
| Browsers | Chrome, Safari (backdrop-filter `-webkit-` prefix), Firefox, Brave auto-dark | Same look |
| Tests | Add a test that `landing-backdrop` and the illustrations are `aria-hidden`; Playwright screenshot for `/en` light + dark | Green in CI |

## 6. Rollout

1. Work on a topic branch (not `remove-scraped-data`), one commit per phase.
2. Open a PR with before/after screenshots (EN/BN, light/dark, mobile/desktop).
3. Collect feedback from 3–5 users on "Is it clear where to start?" — the four service cards should be the obvious entry.
4. Iterate on illustration sizes and copy, then apply Phase 2 to inner pages.
