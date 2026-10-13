# UI theme (UD1) + core components (UD2)

Colours are CSS variables holding `R G B` channels (`app/globals.css`), mapped in `tailwind.config.ts`
as `rgb(var(--x) / <alpha-value>)`, so `bg-primary/90` still works. Dark mode = `class` strategy
(`<html class="dark">`). Old token names are unchanged (`primary`, `surface`, `line`, `ink`, `verified`,
`review`, `critical`, `pending`; `-soft`, `-fg`, `-muted` variants). Never hard-code hex or `text-white`
in components; use `text-primary-fg` / `text-critical-fg`.

## Theme switching
- `public/theme-init.js` (loaded in `<head>`, no flash) reads `localStorage["ls-theme"]` = `light | dark | system` (default **light** since U3; dark only by explicit choice).
- `components/ThemeToggle.tsx` (header) sets the class and saves the choice; storage access is in try/catch (`lib/theme.ts`).
- Print is always light (`@media print` re-declares the light palette).

## Brand scale — "Formal Green" (U1)
Flat tokens: `primary` #006A4E (`primary-hover` #00563F), `link` #0F3D7A (navy inline links), `strip` #0E1F36 (top demo strip), `accent` #B08414 (thin gold rule / focus accent, sparingly), page `surface-muted` #F4F7F5, `line` #D5DED9.
`primary-50 … 900` = #E6F2ED #C7E3D8 #94C8B5 #5FAA90 #2F8C6F #0F7F61 #006A4E #00563F #004232 #002E23 (`primary` = 600 in light; dark primary #4CC38A).
Header, glass and gradient variables are all solid (`--header-*`, `--glass-*`, `--grad-*` hold one value each); `.header-glass` / `.header-gradient` = solid primary, no blur. Header stays #00563F in dark.
Shape: radius md 4 px, lg 6 px, xl/2xl 8 px; `shadow-card` none (border-based), `shadow-raised` 0 2px 8px ink/8 % for menus, modals, map overlays only.
Green = verified, red = critical only, amber = review, grey-blue = pending. Status is never colour-only.

## Contrast (WCAG ratio, text on its background; computed from globals.css, needs ≥ 4.5)
| Pair | Light | Dark |
|---|---|---|
| ink / surface | 16.6 | 14.9 |
| ink / surface-muted | 15.4 | 16.5 |
| ink-muted / surface | 6.7 | 7.5 |
| ink-muted / surface-muted | 6.2 | 8.3 |
| primary / surface | 6.6 | 7.8 |
| primary / surface-muted | 6.1 | 8.7 |
| primary-fg / primary | 6.6 | 7.7 |
| primary-fg / primary-hover | 8.7 | 9.6 |
| primary / primary-soft | 5.8 | 6.4 |
| link / surface | 10.7 | 8.5 |
| link / surface-muted | 9.9 | 9.5 |
| verified / verified-soft | 5.6 | 7.8 |
| verified / surface | 6.4 | 9.0 |
| review / review-soft | 5.5 | 8.8 |
| critical / critical-soft | 5.1 | 5.9 |
| critical / surface | 6.0 | 6.3 |
| critical-fg / critical | 6.0 | 6.7 |
| pending / pending-soft | 5.6 | 5.9 |
| white / header (solid) | 6.6 | 8.7 |
| white / strip | 16.6 | 19.3 |
| accent / surface (UI ≥ 3) | 3.4 | 7.9 |

## Core components (UD2) — `components/ui/`, `components/domain/`
All use tokens only (both themes). Icons: `lucide-react` (decorative, `aria-hidden`; text carries meaning).
- Button: `variant` primary|secondary|danger|ghost, `size`, `loading` (spinner, aria-busy), `icon` / `iconRight` slots; focus ring `ring-primary/50`.
- Card: `title`, `icon`, `footer`, `accent` none|primary|verified|review|critical (top strip, `data-accent`); tinted header.
- Input / Select: hover + focus ring (primary, critical on error), error line has an icon + `role="alert"`.
- Badge: pill with border; optional `icon`. StatusBadge / RiskBadge pass a tone icon (check / warning / cross / clock; shield for HIGH).
- Table: zebra rows, row hover, tinted header, chevron sort icons, `stickyHeader` (opt-in, 70vh scroll area).
- Modal: dimmed blurred overlay, close button with X icon, divided header/footer. Tabs: tinted active tab + underline.
- EmptyState / ErrorState / LoadingState: icon in a tinted circle / alert icon + left accent / spinner (`motion-reduce` stops it).
API, roles, aria names and `data-variant` / `data-tone` are unchanged.

## Shell (UD3) — header, footer, demo strip
- Header (`features/landing/Navbar.tsx`, `components/HeaderMenu.tsx`, `HeaderNav.tsx`): fixed blue gradient in BOTH themes (`.header-gradient`, vars `--header-from/--header-to`), so header text is always white. Logo mark always sits on a white rounded chip (navy parts vanish on blue). Active link = `aria-current="page"` + pill + underline (most specific href wins, `activeNavHref`). User chip + role badge + sign-out button (icon). Below `md` the nav + theme toggle + language switch collapse into a panel (`#site-menu`, button `aria-expanded`/`aria-controls`, closes on Esc and route change).
- `ThemeToggle` and `LanguageSwitcher` take `variant="default" | "onBrand"` (segmented controls; onBrand = translucent white track, white active segment with navy text).
- Footer (`features/landing/Footer.tsx`): brand column, one labelled nav (Explore / Account columns), notice column with the disclaimer, bottom bar with the demo label. Soft gradient background, primary top border.
- Demo banner: REMOVED in UD12 (the demo disclaimer stays in the hero, footer and map page note).
- New i18n keys: `nav.menu|menuOpen|menuClose`, `footer.*`.

Header contrast (white text on the gradient ends): light 12.6 / 6.4, dark 15.0 / 18.5; white at 85 % on the lightest end 5.1; white on the active pill (white/15) worst case 4.6. Navy text on the white active segment 10.7.

## Landing (UD4) — `features/landing/{Hero,Stats,Sections}.tsx`

Hero uses `bg-brand-gradient-soft` (light: blue tint → white, dark: deep blue → near-black) with theme text colours;
`logo-full.png` always sits on a white card (decorative `alt=""`, h1 carries the name). Stat tiles = facts that exist in
the code (13 fields, 2 languages, 6 steps, 7 seeded parcels; keys `landing.stats.*`). How-it-works/features/trust/problem
cards get a lucide icon chip (`aria-hidden`); trust section is a gradient band. Only local `/brand/*` images.

## Map polish (UD7) — `features/map/*`
Search menu = themed panel with a blue gradient title bar (`.header-gradient`, white text), primary Search button, outlined Reset button (icons). Legend is a floating card bottom-right on the map (still `role=region`, named "Map legend", text for every level). Fullscreen button (top-right, `aria-pressed`, Esc leaves; the page root drops its CSS transform while fullscreen so `position: fixed` works). Parcel list rows are cards with a risk-coloured left edge (`data-risk`; level is also text). Leaflet popups are themed in `app/globals.css` (`.ls-popup`, unlayered so they beat leaflet.css). New keys `map.gis.fullscreen|exitFullscreen`.

## Verify / result / report (UD5)
Verify form: card with icon + primary accent on a soft gradient panel, full-width submit with icon. Result: land info rows are tinted tiles with icons; ownership timeline has ring dots and a green rail for the current owner; RiskCard gets an accent by level, a 4xl coloured score and a bar with tick marks at 30 and 60 (`role=meter` unchanged); EvidenceList items have a severity icon (octagon / triangle / info) + coloured left edge, badge text unchanged. Report keeps the A4 print rules (`.report`), icons are decorative, print forces the light palette.

## Officer dashboard (UD6) — `features/officer/*`
KPI tiles: tinted by meaning (total = primary, pending = amber, high risk = red, verified = green) with an icon chip and an accent strip; testids/labels unchanged. Charts take colours from the tokens (`rgb(var(--verified))` etc., axis/grid/tooltip too), so they follow the theme; legend items stay as text pills. Sidebar is tinted (`bg-primary-soft/50`), sticky on desktop, items have icons, active = filled pill. Alerts cards have a severity-coloured left edge; activity feed has dot markers; queue card has a primary accent and a primary Search button.

## Login / upload / review / audit (UD8)
Login: card with shield icon + primary accent on a soft gradient panel, logo mark (transparent, drop shadow, decorative), full-width Sign in button with icon, error shown as a tinted alert box with icon (still `role="alert"`). Upload: large dashed drop zone with a cloud icon in a tinted circle, selected file as a chip, errors as tinted alert box, thicker progress bar (`role="progressbar"` unchanged), success card with green accent and details panel. Review: gradient header strip with icon, field rows get a left edge coloured by confidence band (`data-band` on the row; the badge still carries label + percent, so colour is never the only signal), edit buttons with pencil icon, low-confidence banner with warning icon. Audit: card icon, tinted filter panel, Search/Reset buttons with icons. No i18n keys, roles, aria names or testids changed.

## Header + hero follow the sketch (UD10)
- Header (single row): brand (logo chip + wordmark) · bar nav = **Home, Parcel map** (`primary: true` in `NAV_ITEMS`; Parcel map only when signed in) · right side: theme toggle **sun | moon** (header variant shows two segments; a saved "system" choice highlights what the OS resolves to; default variant still has three) · language **EN | BN** (visible short codes, `aria-label`/`title` keep "English"/"বাংলা") · **user icon** (`components/UserMenu.tsx`).
- User icon: anonymous → link to `/login` (aria-label "Sign in"); signed in → button `aria-label` "Account menu" (`aria-expanded`, panel `#account-menu`, closes on Esc / outside click / route change) with name + role badge, the pages not in the bar (role-filtered: Verify land, About, Dashboard, Upload document) and Sign out.
- Landing hero: left = header card (tagline pill, h1, intro) with the two actions underneath (**Verify Land** → `/verify`, **Upload Doc** → `/officer/upload`, new key `landing.ctaUpload`; `landing.ctaLogin` is no longer used on the hero, sign-in is the user icon); right = large icon card (logo-full on white, decorative). Disclaimer strip below. Below `lg` the icon card stacks under the actions.
- New key `nav.account`. `HeaderNav` now renders only the `<nav>`; the account block moved to `UserMenu`.

## Known gaps (later UD phases)
Hex colours remain in `features/map/*` (risk outline colours, `riskColor` test pins them; the map keeps light OSM tiles); `bg-white` QR chip is intentional. `features/graph/GraphCanvas.tsx` now uses theme tokens (UD9). UD5–UD8 were run in Q1 (green).

## New logo, dark palette, glass header (UD11)
- Logo: `public/brand/{logo-full,logo-mark,icon}.png` + `app/icon.png` regenerated from the new LandShield BD artwork (background levelled to white; still sit on white chips/cards, decorative `alt=""`). Mark chip is now wider (`h-10`, image `h-8 w-auto`); hero logo card max width 26rem; login mark `h-20`.
- Dark palette (`:root.dark`): page 9 14 26, surface 18 26 43, line 44 57 82, ink 232 238 247, muted 156 171 194, primary sky 110 168 254 (fg 8 17 33), verified emerald 52 211 153, review amber 251 191 36, critical coral 248 113 113, pending 148 163 184; tinted `-soft` backgrounds for each. Neutral ink-navy instead of saturated blue; status colours are brighter so they read on dark.
- Dark contrast (computed, >= 4.5): ink/surface 14.9, ink/page 16.5, ink-muted/surface 7.5, ink-muted/page 8.3, primary/surface 7.2, primary/page 8.0, primary-fg/primary 7.8, primary/primary-soft 6.1, verified/soft 7.8, verified/surface 9.0, review/soft 8.8, critical/soft 5.9, critical/surface 6.3, critical-fg/critical 6.7, pending/soft 5.9.
- Header = glass: `.header-glass` (translucent tinted gradient `--glass-from/--glass-to` at `--glass-a` 0.78 light / 0.62 dark, `backdrop-filter: blur(16px) saturate(160%)`, hairline white border, soft shadow; solid fallback via `@supports not`). Header is `sticky top-0 z-[1500]` (above map overlays z-1000, below fullscreen map z-2000); the layout wrapper is `display: contents` so sticky works. White text stays >= 4.5 on the light end over a white page (approx 5.5-6.5); inactive links are white/90.

## UD12 (2026-10-02)
- Logo redrawn as a 3D-look vector (bevelled red/navy shield, glossy map + ruby dot, glass cube + pin, green arrow, laurel wreath, copper nameplate in the full version). Transparent PNGs: `public/brand/logo-mark.png` (512x480), `logo-full.png` (768x876), `icon.png` + `app/icon.png` (256, transparent); source `public/brand/logo-mark.svg`. No white chips any more: Navbar/Footer/Login use the bare mark with a drop shadow, Hero card uses `bg-surface`, so dark mode has no white box.
- Top "demo" strip removed (`DemoBanner` deleted from layout, component and test).
- Map page: every text block (title row, intro, hints, filter + parcel list) gets `px-4 sm:px-6 lg:px-8`; the map itself stays edge-to-edge.


## Real logo, transparent background (UD13)
- `public/brand/{logo-mark,logo-full}.png` + `icon.png` + `app/icon.png` are now cut from the user's `logo3.jpeg` (the JPEG had a checkerboard baked in; removed by connected-region masking, pockets between wreath/shield cleared, name plate restored, 1px edge feather). Transparent RGBA: mark 820x608 (no name plate, used in header/footer/login), full 820x695 (with LANDSHIELD BD plate, hero card), icon 256x256. Old redrawn `logo-mark.svg` deleted. Not run: browser check on light/dark.


## Role-aware UI + wording (UD14)
- Hero: `HeroActions` shows Upload Doc only for OFFICER/ADMIN (same set as the /officer/upload guard).
- Dashboard h1: `officer.title` (Officer) / `titleAdmin` / `titleReviewer`.
- User-visible text says 'sample/synthetic' or 'not an official government land record' instead of 'demo'. Message keys (demoLabel etc.) keep their names.

## Accessibility + responsive (P54, Q8)
- **axe-core 4.13** runs in `frontend/tests/a11y.test.tsx` on home, verify, result, report, login, review and dashboard, in EN and BN (14 cases + a harness sanity test that proves axe catches a bad fragment). Zero violations of any impact. jsdom has no layout, so `color-contrast` is off there (contrast = the computed table above); `region`, `landmark-one-main`, `page-has-heading-one` are off because the tests render fragments (the real `<main>`/`<header>` live in `app/[locale]/layout.tsx`).
- **Tap targets ≥ 44 px:** `Button` (md and sm), `Input`, `Select`, `Tabs`, Modal close, header icon buttons, theme/language segments, nav pills, user-menu rows, map search button are `min-h-11`/`h-11`. `globals.css` adds a `@media (pointer: coarse)` net (buttons, selects, tabs, header/nav/aside/footer links, Leaflet zoom buttons = 44 px). Inline links in running text are exempt.
- **Responsive fixes:** the user-menu dropdown spans the header width below 768 px (was `left-0` + `w-64`, could run off a 375 px screen); `body { overflow-wrap: break-word }` so long Bangla words, land IDs and e-mail addresses wrap; `prefers-reduced-motion` switches off transitions/animations.
- **Not verified (needs a real browser):** the 375 / 768 / 1440 px walk in EN + BN × light/dark, real contrast, keyboard tab order on the live pages, Leaflet zoom buttons at 44 px. Walk list for Q9: header + user menu at 375, verify form, result tables (horizontal scroll inside the card only), review split panes stacked, dashboard sidebar drawer, map overlay menu.

## Regression + how-to (UD9, Q9)
**Automated (`frontend/tests/ui-regression.test.ts`, 53 cases, reads the real `app/globals.css`):**
- every colour variable in `:root` also exists in `:root.dark`; the `@media print` palette equals the light palette (page background pure white);
- all 15 text/background pairs of the contrast table are >= 4.5 in light, dark and print; white header text >= 4.5 on both gradient ends in both themes;
- `@page` is A4 and print forces a white page; Tailwind `darkMode: "class"`; `theme-init.js` is external;
- no `text-white` / `text-black` outside the always-blue header and map overlay files; no hard-coded hex strings in `.tsx` (map canvas excluded).
Changing a palette value that breaks one of these fails the suite, so the table above cannot silently go stale.

**Fix in UD9:** React Flow edges/labels in `GraphCanvas` used fixed hex (flagged red edge 2.4:1 on the dark canvas, white label chips). They now use `rgb(var(--critical))`, `rgb(var(--pending))` and `rgb(var(--surface))`.

**Add a page (checklist):**
1. Route in `app/[locale]/<name>/page.tsx`; logic in `features/<name>/`; guard by role in `features/auth/roles.ts` if needed.
2. Colours only from tokens (`bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `text-primary`, `bg-verified-soft` ...); no hex, no `text-white` (use `text-primary-fg`). Status = colour + icon + text.
3. Use `components/ui/*` (Button, Card, Table ...). Icons: `lucide-react`, `aria-hidden`.
4. Text via `useTranslations`; add the key to `messages/en.json` AND `bn.json`; run `npm run check:i18n`.
5. 44 px controls (the `ui/` components already are), wrap long values (`break-words`), tables inside `overflow-x-auto`.
6. Add the page to `tests/a11y.test.tsx` (EN + BN) and a feature test; add `print:hidden` to non-report chrome if the page is printable.
7. `npm test && npx tsc --noEmit && npm run check:i18n`.

**Manual walk (NOT done: the sandbox has no browser; run locally with `npm run dev`, tick when done).** Per cell = EN/BN x light/dark; widths 375 / 768 / 1440:
- [ ] Home: header (menu button at 375, no overlap), hero, stat tiles, how-it-works, footer
- [ ] Verify form + result: tables scroll inside their card only, risk card, graph (dark: edges readable), timeline
- [ ] Report: Ctrl+P preview in dark mode is light, A4, no header/buttons, sections not split
- [ ] Login, Upload (drop zone), Review (panes stack at 375), Audit table
- [ ] Officer dashboard: KPI tiles, charts in dark, sidebar/drawer
- [ ] Admin console: users table, create/edit modal
- [ ] Map: overlay menu, legend, fullscreen + Esc, zoom buttons 44 px on touch, popup in dark
- [ ] Bangla: no horizontal page scroll at 360 px, glyphs not clipped in buttons
- [ ] Keyboard: Tab order header -> main, visible focus ring in both themes, Esc closes modal/menu


## Shell (U3) — top strip, header, footer
- Top strip (`components/TopStrip.tsx`, `bg-strip`, 13 px): demo notice left; text size A− / A / A+ (100 / 112.5 / 125 % on `<html>`, key `ls-text-size`, try/catch, applied before paint by `theme-init.js`) and language switch (বাংলা first) right.
- Header (`features/landing/Navbar.tsx`): solid primary, 2 px accent rule, mark + wordmark + Bangla sub-line (`common.subLine`), service nav Home · Verify land · Parcel map · Mouza map (signed in); only routes that exist. Language switch moved to the strip; theme toggle moved into the account menu (signed in) and the footer bar.
- Footer (`bg-strip`, white text, accent top rule): Services · About · Help · Legal; unbuilt pages are plain text. Contact is the placeholder support@landshield.demo.
- Theme default = light (`lib/theme.ts`, `theme-init.js`).

## U4 — Brand + Bangla-first (2026-10-06)
- Logo is now flat SVG: `public/brand/logo-mark.svg`, `logo-full.svg`; `app/icon.png` rendered from the mark; old PNGs in `public/brand/legacy/` (unreferenced). Earlier logo notes above are historical.
- Default locale `bn`; `:lang(bn)` typography rules at the end of `app/globals.css`.
