# Bangla copy rules and glossary (U0.1, 2026-10-16)

Applies to `frontend/messages/bn.json`. Enforced in review; based on §5 of `docs/ui-ux-roadmap.md`.

## Rules
- Bangla digits in every value (`১২৪৫`, `১০ এমবি`). Numbers that come from code go through `Intl.NumberFormat("bn-BD")` / `localDigits`.
- One idea per sentence, under 20 words. Split clauses joined by `;` into separate sentences.
- Plain spoken words over Sanskritised or English terms. If a citizen would not say it at a land office, rewrite it.
- Keys and ICU placeholders (`{date}`, `{count, plural, …}`, `#`) never change. Only the text around them does.
- Citizen pages (home, verify, result, check, track, verify-document, public QR page, tools, info pages, sign-up) get the full glossary. Staff pages (officer, reviewer, admin) use the same glossary terms, but may keep the loanwords listed below.

## Glossary
| Avoid | Use | Note |
|---|---|---|
| রিস্ক স্কোর ৭০, স্কোর, পয়েন্ট | ঝুঁকি: উচ্চ / মাঝারি / নিম্ন; "ঝুঁকির হিসাবে # নম্বর" | Show the level, never a bare score |
| OCR, ওসিআর, এক্সট্রাকশন, নিষ্কাশন, এক্সট্র্যাক্টর | দলিল থেকে তথ্য পড়া; পড়া তথ্য; পড়ার পদ্ধতি | "OCR আস্থা" → পড়ার নির্ভরযোগ্যতা |
| হ্যাশ, স্বাক্ষর, স্বাক্ষরিত, SHA-256 (record integrity) | ডিজিটাল সিল; সিলযুক্ত রেকর্ড | |
| হ্যাশ / ফিঙ্গারপ্রিন্ট (of a file) | ডিজিটাল ছাপ | IP hash → আইপি সংকেত |
| এনকাম্ব্রান্স, দায়, দায়বদ্ধতা, দাবি, দায়-বিবরণ | দায়-দেনা (মামলা, বন্ধক, খাস, অধিগ্রহণ) | |
| স্ট্যাটাস | অবস্থা | |
| QR | কিউআর কোড | |
| মিউটেশন, ই-মিউটেশন | নামজারি, ই-নামজারি | `result.mutations` keeps "(মিউটেশন)" once as a hint |
| ডকুমেন্ট | নথি (দলিল when it is a deed) | |
| রিভিউয়ার, অ্যাডমিন | পর্যালোচক, প্রশাসক | Same as `roles.*` |
| ডেটা, ডেটাসেট, কৃত্রিম ডেটা | তথ্য; কাল্পনিক / নমুনা তথ্য | |
| প্রোটোটাইপ, সিভিক-টেক, ই-গভর্নেন্স | ডেমো; পরীক্ষামূলক | Demo ribbon: "শিক্ষার্থীদের তৈরি ডেমো · সরকারি ওয়েবসাইট নয়" |
| টুলস, ক্যালকুলেটর | হিসাব-সহায়ক; … হিসাব | |
| গ্রাফ, নোড, ক্যানভাস | মালিকানার চিত্র; ঘর | |
| পাবলিক | সবার জন্য খোলা | |
| রেফারেন্স | সূত্র নম্বর | |
| নির্দেশক, ঝুঁকি-নির্দেশক | সতর্ক সংকেত; ঝুঁকির সংকেত | |
| মানব পর্যালোচনা প্রয়োজন | একজন পর্যালোচকের দেখা দরকার | |
| ওভারল্যাপ, রেজোলিউশন, এক্সটেনশন, ক্যাডাস্ট্রাল | describe it: "একটির ওপর আরেকটি পড়েছে", "ছবির মাপ", "ফাইলের নাম", "মৌজা নকশা" | |
| চেকলিস্ট, প্রি-চেক | তালিকা; প্রাথমিক যাচাই | |
| প্রিন্ট | ছাপুন | |
| হোম | প্রথম পাতা | |
| নেভিগেশন (aria labels) | মেনু | |
| ডিভাইস, স্ক্র্যাপ, রেট লিমিট, ওয়ারেন্টি, অ্যানালিটিক্স ট্র্যাকার | ফোন বা কম্পিউটার; স্বয়ংক্রিয়ভাবে নামানো; চেষ্টার সীমা; নিশ্চয়তা; নজরদারির কোড | |
| আইনগত মালিকানা প্রতিষ্ঠা / স্বত্ব প্রত্যয়ন | মালিকানা ঠিক করে না / মালিকানার সনদ দেয় না | |

**Accepted loanwords** (widely used, no clearer Bangla): সাইন ইন, সাইন আপ, সাইন আউট, ইমেইল, পাসওয়ার্ড, অ্যাকাউন্ট, মোবাইল, ফাইল, পিডিএফ, স্ক্যান, কপি, লিংক, মেনু, আইডি, আইপি, কুকি, ক্লিক, এআই. Staff screens only: ড্যাশবোর্ড, আপলোড, ফিল্টার, অডিট লগ, লেজার, এন্ট্রি, রিসেট, প্রিভিউ, জুম. Citizen screens say "জমা দিন" instead of "আপলোড".

**Latin script allowed only for:**
- Codes the user must type exactly: `LP-10100`, `MUT-2026-0001`, `FB-2026-00001`, phone `+8801711000000`. The validators accept ASCII only (`LAND_ID_RE`, `MUTATION_NO`, `PHONE`), so the hint text says "ইংরেজি অঙ্কে".
- Proper names: LandShield BD, OpenStreetMap, geoBoundaries, Tesseract, Claude, GNU FreeSans, README; file types JPG / PNG / PDF; licences MIT, ODbL, CC BY 4.0.

## Audit result (U0.1)
- 230 strings rewritten in `bn.json`. Keys and placeholders are unchanged; a script checked placeholder sets per key.
- Latin digits remaining: only the allowlist above (7 strings).
- Sentences over 20 words: 0. Before the audit there were 2 (`about.purpose.body`, `info.privacy.s3.body`).
- Tests updated for the new wording: `features/review/engine-badge.test.tsx`, `features/risk/risk.test.tsx`.
- Open items for later tasks:
  - U0.2 should turn the Latin-digit rule into a test that uses this allowlist.
  - Phone, land ID and mutation number inputs should accept Bangla digits (normalise like `features/verify/schema.ts`).
  - Brand: roadmap §5 asks for "ল্যান্ডশিল্ড বিডি", but `tests/i18n-parity.test.ts` currently requires `LandShield BD` and forbids the Bangla spelling. This needs a decision before U1.

# Design tokens + risk indicator (U0.3, 2026-10-17)

Extends the tokens below (Design v2, U1); nothing was renamed. Roadmap §5 "Visual".

## Green palette (confirmed, unchanged)
| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#006A4E` (government green, = `primary-600`) | `#4CC38A` | buttons, links on cards, focus ring |
| `primary-hover` | `#00563F` | `#6ED6A5` | hover / pressed |
| `primary-soft` | `#E6F2ED` | `#0E3028` | tinted panels, glass-card tint |
| `primary-50 … 900` | `#E6F2ED` → `#002E23` | same | fixed scale for illustrations and charts |
| `brand-deep` / `brand-deep-2` | `#0A3527` / `#0F4A35` | same | header, hero band, footer |
| `gold` family | `#D6B25C` … | same | one accent per view only |
Red (`critical`) is only for high risk and errors. Amber (`review`) means medium risk / needs review.

## Bangla type scale
`text-xs … text-xl` read CSS variables (`--text-*`, `--leading-*` in `globals.css`); `tailwind.config.ts` maps them, so class names are unchanged and every component picks up the scale. `body` uses `text-base`.

| Class | EN size / line | BN size / line (`:root:lang(bn)`) |
|---|---|---|
| `text-xs` | 12 / 16 px | **13 px / 1.6** (smallest Bangla text) |
| `text-sm` | 14 / 20 px | 15 px / 1.6 |
| `text-base` (body) | 16 / 24 px | **17 px / 1.7** |
| `text-lg` | 18 / 28 px | 19 px / 1.6 |
| `text-xl` | 20 / 28 px | 21 px / 1.5 |
- Bangla headings `h1–h3` are weight 600 and line-height 1.35 (`:lang(bn)` rules at the end of `globals.css`). `text-2xl` and up and the fluid `heading-*` sizes are unchanged.
- Arbitrary sizes (`text-[0.8125rem]` etc. in the header, hero, auth panel) are not part of the scale. Leave them alone unless the screen is reworked.

## Touch targets (48 px)
- Token `--touch-target: 3rem` → Tailwind `min-h-touch`, `min-w-touch`, `h-touch`, `w-touch`.
- `Button` (every size; sm/md/lg differ only in padding and text), `Input`, `Select`, `Tabs`, Modal close and Toast close are at least 48 px on every screen. Input/Select no longer shrink to 44 px on desktop.
- The `@media (pointer: coarse)` net in `globals.css` is now 48 px (buttons, selects, tabs, header/nav/aside/footer links, Leaflet zoom). Header icon buttons and segments stay `h-11` on desktop and get 48 px on touch screens through this net.
- `tests/a11y.test.tsx` ("touch-target contract") fails if a shared control goes back to `min-h-11` or the net drops the token.
- Checked 2026-10-17 at 360 px with touch emulation (bn: home, verify, result, map, tools, officer dashboard): no horizontal scroll and no button, field or tab under 48 px.

## Risk indicator — `components/domain/RiskIndicator.tsx`
Use it for **every** parcel risk level. It always shows colour + icon + word together: never colour alone, never a bare score.

| Level | Tone (token) | Icon (lucide) | EN | BN |
|---|---|---|---|---|
| `LOW` | `verified` (green) | `CheckCircle2` (circle) | Risk: Low | ঝুঁকি: নিম্ন |
| `MEDIUM` | `review` (amber) | `AlertTriangle` (triangle) | Risk: Medium | ঝুঁকি: মাঝারি |
| `HIGH` | `critical` (red) | `AlertOctagon` (octagon) | Risk: High | ঝুঁকি: উচ্চ |
| anything else / null | `pending` (grey-blue) | `HelpCircle` | Risk: Not known | ঝুঁকি: জানা নেই |

- Props: `level`, `size` = `sm` (table cell, legend) | `md` (default chip) | `lg` (headline on the risk card: 48 px icon tile, label above, big word), `showLabel` (default `true`; `false` keeps "Risk:" for screen readers only, for use under a "Risk" column or `<dt>`).
- The icon is `aria-hidden`; the text carries the meaning. The icon shapes differ, so the level is still readable in greyscale print and for colour-blind users. `data-risk` / `data-tone` are set for tests.
- Exports `RISK_LEVELS`, `RISK_TONE`, `RISK_ICON`, `riskLevelOf`. Evidence and alert severities (HIGH / MEDIUM / INFO) are a different scale. They keep their own `Badge` but import `RISK_TONE` from here.
- Strings: `risk.label`, `risk.level.{LOW,MEDIUM,HIGH,UNKNOWN}`, `risk.scoreLine` (both locales).
- Used in: result header chip (`ResultView`), `RiskCard` (lg), public QR page (chip + "Risk level" field), map parcel list and map legend (next to the outline swatch), officer queue "Risk" column. `RiskBadge` was removed.
- `RiskCard`: the level is the headline. The score is one secondary line ("ঝুঁকির হিসাবে ১০০-এর মধ্যে ৭০", Bangla digits via `Intl.NumberFormat(intlLocale(locale))`). The bar's `aria-valuetext` says the level too.
- Not switched: map polygon outline colours (map data, `RISK_COLOR`) and the Leaflet popup (text only, so it is not colour-only).

Contrast of the level word (WCAG, needs ≥ 4.5; locked in `tests/ui-regression.test.ts`):
| Pair | Light | Dark |
|---|---|---|
| verified / verified-soft · surface · primary-soft (glass tint) | 5.6 · 6.4 · 5.6 | 7.8 · 9.0 · 7.4 |
| review / review-soft · surface · primary-soft | 5.5 · 6.1 · 5.3 | 8.8 · 10.4 · 8.5 |
| critical / critical-soft · surface · primary-soft | 5.1 · 6.0 · 5.2 | 5.9 · 6.3 · 5.2 |
| pending / pending-soft · surface | 5.6 · 6.5 | 5.9 · 6.8 |

Tests: `components/domain/RiskIndicator.test.tsx` checks every level × size × locale for tone, a hidden icon, the word and the "Risk:" prefix, and that no digits appear. It also checks distinct icon shapes, the unknown fallback, Bangla strings and axe. `features/risk/risk.test.tsx` checks the level headline and the Bangla-digit score line.

# Design v2 (UI REDESIGN V2, 2026-10-15)

Source of truth = the landing page `/` and the sign-in pages. Every inner page now uses the same language; older sections below describe the earlier flat U1–U7 look and stay for history.

## Tokens (`globals.css`, `tailwind.config.ts`)
| Token | Value | Use |
|---|---|---|
| `brand-deep` / `brand-deep-2` | `10 53 39` / `15 74 53` | header, footer, page hero band, sign-in panel, officer sidebar header (same in both themes) |
| `gold`, `gold-strong`, `gold-soft` | `214 178 92`, `233 201 111`, `241 216 140` | ONE gold touch per view: active nav, accent bar under H1/H2, primary CTA on dark surfaces. Never body text on light surfaces |
| `rounded-card` / `rounded-panel` / `rounded-hero` | 14 / 20 / 24 px | cards / panels and hero band / landing banner |
| `shadow-glass`, `shadow-lift` | soft + lifted | resting and hover glass cards |
| `.glass-card`, `.section-panel`, `.icon-tile`, `.page-hero`, `.scroll-fade`, `.skeleton`, `.reveal` | utilities | glass container, tinted section, icon square, deep-green band, fading scroller, shimmer, scroll reveal |
| H1 / H2 | `clamp(1.75rem, 1.2rem + 2.2vw, 2.6rem)` / `clamp(1.375rem, 1.1rem + 1vw, 1.75rem)` | fluid headings; Bangla keeps its own rules |

## Components
- `Card` glass by default, `tone="panel"` = section panel, icon in a tile, accent/record = 3 px left bar.
- `Button` sizes sm / md 44 px / lg 48 px (all 48 px since U0.3), `variant="gold"`, `fullWidthOnMobile`. `Badge` is a pill with optional dot.
- `Input`/`Select` 48 px on phones, 3 px focus glow. `Tabs` `variant="underline" | "segmented"`, fading scroll edges, `sticky`. `Modal` = bottom sheet < 640 px.
- `Table` stacks into label/value cards < 640 px (`stackOnMobile`, pure CSS, same markup). Note: `display:block` on the table drops table semantics in Safari/VoiceOver on phones; the label is repeated per cell via `data-label`.
- `PageHeader` renders `PageHero` (hero band, breadcrumb, meta chips, art, actions); `variant="plain"` for the officer area. `ServiceLayout` = Template A (form 7/12 + sticky "What you need"; collapsible `<details>` below 1024 px). `StateCard` = Template G (404, error). `ArtCard` shared by landing and tools hub. `Reveal`, `ToastProvider/useToast`, `Skeleton`.
- One `PublicBackdrop` in the locale layout (not on `/officer/*`, `/map`).

## Templates
A service pages (verify, check, track, verify-document) · B result/report/public QR · C hubs (tools, services) · D reading pages (70 ch, sticky TOC ≥ 1280) · E officer workspace (deep-green header block sidebar, icon rail 1024–1279, drawer < 1024) · F map/graph (floating glass panels) · G system states.

## Contrast of the new surfaces (WCAG, needs ≥ 4.5 : 1; computed 2026-10-15)
| Pair | Ratio |
|---|---|
| white on deep green `#0A3527` | 13.5 : 1 |
| white on deep green 2 `#0F4A35` | 10.2 : 1 |
| white 85 % on deep (hero purpose line) | 7.9 : 1 |
| white 75 % on deep (breadcrumb) | 6.5 : 1 |
| gold `#D6B25C` on deep | 6.7 : 1 |
| gold-soft `#F1D88C` on deep | 9.6 : 1 |
| ink on glass card (light) | 15.0 : 1 |
| ink-muted on glass card (light) | 6.1 : 1 |
| primary on glass card | 6.0 : 1 |
| `.btn-gold` text `#1A2A1F` on `#CFA548` | 6.5 : 1 |

## QA gate (R11)
- Overflow matrix run against the dev servers (18 public + 5 citizen routes, reviewer/admin officer routes) at 320 / 360 / 768 / 1024 / 1440 px × EN/BN × light/dark (dark at 360 and 1024): after fixing the landing service cards at 320 px (grid column `min-w-0`) **no horizontal scroll anywhere**. `frontend/e2e/visual.spec.ts` repeats this in Playwright (`VISUAL_FULL=1` for the whole matrix; screenshots attached, no committed baselines).
- axe (`tests/a11y.test.tsx`): all routes of the E5 suite + system states + modal, EN and BN: no violations.
- NOT run here: Lighthouse mobile (LCP / CLS / TBT), real devices (iPhone SE, Android, iPad, Safari, Firefox, Brave auto-dark), `next build`. Do these before the final demo.
- Not done: parcel details as a bottom sheet on the map (Leaflet popup kept).

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
- **Tap targets ≥ 44 px (raised to 48 px in U0.3, see above):** `Button` (md and sm), `Input`, `Select`, `Tabs`, Modal close, header icon buttons, theme/language segments, nav pills, user-menu rows, map search button are `min-h-11`/`h-11`. `globals.css` adds a `@media (pointer: coarse)` net (buttons, selects, tabs, header/nav/aside/footer links, Leaflet zoom buttons = 44 px). Inline links in running text are exempt.
- **Responsive fixes:** the user-menu dropdown spans the header width below 768 px (was `left-0` + `w-64`, could run off a 375 px screen); `body { overflow-wrap: break-word }` so long Bangla words, land IDs and e-mail addresses wrap; `prefers-reduced-motion` switches off transitions/animations.
- **E5 pass (2026-10-14), every route:**
  - **jsdom axe** (`tests/a11y.test.tsx`) now covers 33 views (home, verify, check, track, verify-document, result, report, login, officer-signup, tools x4, services, FAQ/accessibility/privacy/terms/data-sources/sitemap, feedback, public QR page, 404, error, review, dashboard, officer upload/mutations/archive/audit-log/feedback) in EN and BN: zero violations of any impact.
  - **Real browser axe** (`frontend/e2e/a11y.spec.ts`, Chromium, **360 px wide, text size 125 %**, light theme, EN + BN, colour contrast and landmark rules ON) runs on 20 public routes, 5 citizen routes (verify, check, map, result, graph), 6 officer routes and the admin console, and also asserts no sideways scroll. Colour contrast: no failures on any route.
  - **Keyboard only** (`frontend/e2e/keyboard.spec.ts`): Tab from the top of the map page reaches the footer (no trap) and every stop shows a focus indicator; the verify form is filled and submitted without a mouse. The mouza combobox now supports ArrowUp/ArrowDown/Enter/Escape with `aria-activedescendant` (unit test in `features/verify/verify.test.tsx`; the browser test cannot reach it because no mouza list ships).
  - **Fixed from this pass:** demo strip was outside any landmark (now a labelled region); check and verify-document had no `<h1>` (PageHeader added); two links distinguished only by colour (login, officer sign-up) are underlined; the map parcel list had two landmarks with one name; wide tables were not keyboard-scrollable (the scroll area is now a labelled tab stop); the officer queue search button overflowed 88 px at 360 px / 125 % text; the mouza suggestions could not be used with a keyboard.
  - **Not covered:** dark theme in the browser run, screen readers (no NVDA/VoiceOver run), real devices, the review page `/officer/review/{id}` and mutation detail in the browser run (need a seeded document id).
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
- Header (`features/landing/Navbar.tsx`): solid primary, 2 px accent rule, mark + wordmark + Bangla sub-line (`common.subLine`), service nav Home · Verify land · Parcel map (signed in); only routes that exist. Language switch moved to the strip; theme toggle moved into the account menu (signed in) and the footer bar.
- Footer (`bg-strip`, white text, accent top rule): Services · About · Help · Legal; unbuilt pages are plain text. Contact is the placeholder support@landshield.demo.
- Theme default = light (`lib/theme.ts`, `theme-init.js`).

## U4 — Brand + Bangla-first (2026-10-06)
- Logo is now flat SVG: `public/brand/logo-mark.svg`, `logo-full.svg`; `app/icon.png` rendered from the mark; old PNGs in `public/brand/legacy/` (unreferenced). Earlier logo notes above are historical.
- Default locale `bn`; `:lang(bn)` typography rules at the end of `app/globals.css`.

## U1.1 — Top strip returns (roadmap §6, Phase 1)
- `components/TopStrip.tsx` is mounted above the header in `app/[locale]/layout.tsx` (not sticky, `print:hidden`). Left: weekday · বঙ্গাব্দ date · খ্রিস্টাব্দ date. Right: text size A− / A / A+, high-contrast toggle, **বাং | EN** pill (`LanguageSwitcher variant="strip"`). The header keeps only the theme button; the language switch moved here.
- Dates: `lib/bn-date.ts` follows the Bangladesh revised calendar (new year 14 April; anchors tested: 8 Falgun = 21 Feb, 12 Choitro = 26 Mar, 2 Poush = 16 Dec) and uses Dhaka time. Rendered after mount, because pages are statically generated and must not bake in a date. Bangla digits come from `localDigits`.
- Text size: `ls-text-size` 100 / 112.5 / 125 on `<html>`; **default is 100 and only an explicit choice changes it** (the 2026-10-15 removal was caused by a stale saved 125 %). `theme-init.js` applies it before paint and `Providers` re-applies it after a language switch.
- High contrast: `ls-contrast = high` adds `contrast` to `<html>`; `:root.contrast` and `:root.dark.contrast` in `globals.css` darken ink, muted text, borders and links, and thicken the focus ring. Off by default.
- Not done here: the demo notice (`strip.notice`) is not shown in the strip (the footer and result pages still carry the demo label).

## U1.2 — Header nav, Bangla brand, sign-in choice (roadmap §6, Phase 1)
- Bar links (`components/HeaderNav.tsx`): হোম · সেবাসমূহ ▾ · হিসাব-সহায়ক (`/tools`) · নির্দেশিকা · নোটিশ · যোগাযোগ. The dropdown is `components/HeaderDropdown.tsx` (a disclosure button + links, not an ARIA menu): Escape closes and returns focus, so do an outside click, focus leaving and navigation. Inside the mobile panel it opens inline; from 1280 px it is a popover.
- সেবাসমূহ lists "সব সেবা" (`/services`) plus the header-primary items of `NAV_ITEMS` the role may see (`/verify-document` is now primary). Anonymous visitors see নামজারির অবস্থা and দলিলের কপি যাচাই only, until the `/verify`, `/check` and `/map` pages become public (U2).
- Targets for pages that do not exist yet: নির্দেশিকা → `/faq` (until `/guide`, U4.1); নোটিশ → `/#notices-title`, the notice board on the home page (until `/notices`, U3.6); যোগাযোগ → `/feedback`. The notice anchor is never marked as the current page.
- Wording: the nav says হিসাব-সহায়ক, not the roadmap's "নাগরিক টুলস", and the button says সাইন ইন, not "লগইন", because the U0.1 glossary fixes both.
- Sign in ▾ (`UserMenu`, anonymous only) offers নাগরিক সাইন ইন (`/login`) and কর্মকর্তা সাইন ইন (`/login?as=officer`). Both use the same form and API; `?as=officer` only changes the heading and intro. Separate pages and redirects per role are U3.1.
- Brand: new key `common.brand` ("ল্যান্ডশিল্ড বিডি" in bn) is used by the header and the footer logo. `common.appName` stays "LandShield BD" for the page title and the report header. `tests/i18n-parity.test.ts` now allows the Bangla spelling in that one key only. This settles the open item from U0.1.

## U1.3 — Hero with tabbed search card (roadmap §6, Phase 1)
- `features/landing/HeroSearch.tsx` sits under the H1 on the photo banner (`-mt-14`, solid `bg-surface` card, so no text sits on the photo except the heading). One `Tabs variant="segmented"` card: জমি খুঁজুন · নামজারির অবস্থা · দলিল / কিউআর যাচাই. The old hero test that forbade a form is replaced by tests for the tabs and each hand-off.
- জমি খুঁজুন is `VerifyForm compact` (বিভাগ → জেলা → উপজেলা → মৌজা → খতিয়ান/দাগ). Land search still needs sign-in until the public summary (U2.1/U2.2), so a visitor who is not signed in goes to `/verify?district=…&dag=…` and sees a note saying so. `RequireRole` now keeps the query in `?next=`, and `/verify` fills itself from the query and searches once when all five fields are there and the user is signed in. Signed-in users search straight from the hero.
- নামজারির অবস্থা checks the number like `/track` does (MUT-YYYY-NNNN or FB-YYYY-NNNNN), then opens `/track?no=…`; `TrackView` reads `?no=` on arrival and looks it up.
- দলিল / কিউআর যাচাই links to `/verify-document` (the copy upload) and takes a pasted QR link or land ID. `qrTarget` keeps only the `/v/{id}` path and the `d`/`h` seal, so a pasted link from any host still opens our own page. Camera scanning is U5.1.
- At 360 px the tab labels use `px-2` so the Bangla words wrap whole; the hero search button spans the full row below `lg`.

## U1.4 — Notice ticker and dated notice list (roadmap §6, Phase 1)
- `components/NoticeTicker.tsx` renders in the locale layout right under `Header` (not sticky: it scrolls away, the header keeps its height). A light `primary-soft` strip with a "নোটিশ" chip, the scrolling notices, a pause button and "সব নোটিশ" (`/#notices-title`). Each item is a dated link to its card on the home page notice board (`/#notice-n1` …).
- One data source: `features/notices/notices.ts` (`id`, `date`, `ticker`). The board shows every notice; the ticker shows only those with `ticker: true` (n3 is board-only). U3.6 replaces this list with admin-managed notices and keeps the flag. Copy stays in `landing.notices.items.<id>`; the ticker's own strings are in the new `ticker` namespace (both locales).
- Motion (WCAG 2.2.2): the loop is CSS only (`.ticker-track` in `globals.css`, 45 s, two equal copies, −50 %), and only under `prefers-reduced-motion: no-preference`. It pauses with the button (`aria-pressed`), on hover and on keyboard focus. With "reduce motion" nothing moves: the row scrolls by hand, and the loop copy and the pause button are hidden. The loop copy is `aria-hidden` and its links are `tabindex=-1`, so screen readers and Tab see each notice once.
- Dates use `Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" })` (Bangla digits in bn). Targets are 36 px on desktop and 48 px on touch screens (`pointer: coarse`).
- Board cards got `id="notice-…"` and `scroll-mt-28` so an anchor jump clears the sticky header.
- Tests: `components/NoticeTicker.test.tsx` (flagged notices only, anchors, hidden loop copy, Bangla digits, pause, axe), board ids and date in `features/landing/landing.test.tsx`.

## U1.5 — Home FAQ accordion (roadmap §6, Phase 1)
- `HomeFaq` in `features/landing/Sections.tsx`, last band on the home page (after Trust): heading `landing.faq.title`, one line of intro, five questions and an "আরও" link to `/faq`.
- The accordion is `features/info/FaqList.tsx`, shared with the `/faq` page (which lists all nine). It is native `<details>/<summary>`, so it works without script and with the keyboard and screen readers; all items start closed, and each question is a 44 px+ target. Answers are the existing `info.faq.<id>` copy: nothing is written twice.
- Which five: `HOME_FAQ_IDS` in `features/info/pages.ts` = q1 (what is it), q2 (is it official), q4 (how to check a plot), q5 (what the risk level means), q6 (can I rely on it). Change that list to change the home page; `FaqId` is typed from `FAQ_IDS`.
- "আরও" is a link, not an in-place expander: the full list already lives on `/faq` (with the page-helpful rating), so there is one place to maintain.
- Tests: `landing.test.tsx` (five questions in order, all closed, opens on click, link to `/faq`, EN and BN). The jsdom and Playwright axe suites already cover the home page and `/faq`.

## U1.6 — Hotline strip and floating help button (roadmap §6, Phase 1)
- **Hotline strip**: `HelpStrip` in `features/landing/Sections.tsx`, the last band on the home page (after the FAQ, so "still stuck?" comes at the end). A heading, one line, a large gold tap-to-call button (`tel:16122`, 48 px+) and an "অথবা আমাদের লিখুন" link to `/feedback`. Under it, a note that 16122 is the government land services line and this site is a demo not run by the ministry, so nobody thinks the hotline belongs to us.
- **Floating help button**: `components/HelpButton.tsx`, mounted once in the locale layout after the footer, fixed bottom-end corner (`end-4`, so it flips with the writing direction), hidden in print. A gold pill "সাহায্য" (48 px) opens a small panel: সচরাচর জিজ্ঞাসা (`/faq`), নির্দেশিকা (`/faq` until `/guide`, U4.1, as in the header), মতামত জানান (`/feedback`) and the hotline. It is a disclosure, not a modal (nothing behind it is hidden or trapped): Escape closes and returns focus to the button, as do a click outside, focus leaving and navigation. `z-40`: above the page, below modals (50), the full-screen map (2000) and toasts (3000).
- One place for the number and links: `features/help/help.ts` (`HOTLINE`, `HELP_LINKS`). The number shows in Bangla digits under `bn` (`localDigits`) but the `tel:` link always dials the ASCII number. Copy: `help` (button and panel) and `landing.help` (strip), both locales. The strip's Bangla note avoids the Bangla brand spelling on purpose (`tests/i18n-parity.test.ts` allows it only in `common.brand`).
- Not checked: the button against the Leaflet controls on `/map` (they are `z-1000` inside the map, so they would sit on top of the button where they overlap; `/map` needs sign-in until U2.3), and the real opening hours of 16122, which the copy does not claim.
- Tests: `components/HelpButton.test.tsx` (closed by default, links, Bangla digits with ASCII `tel:`, Escape and focus, outside click and navigation, axe closed and open in EN and BN), `landing.test.tsx` (strip in EN and BN).

## U2.4 — Result redesign (roadmap §6, Phase 2)
- Order on `/verify/result`: demo note → **verdict** → "বিস্তারিত তথ্য" (collapsible sections) → disclaimer → sticky action bar. The old tab row is gone.
- **Verdict** (`features/result/Verdict.tsx`, `data-testid="verdict"`): `RiskIndicator size="lg"` (colour + icon + word), a one-line headline (`result.verdict.headline.*`), three plain lines, then the "এখন আপনার করণীয়" panel (1–3 numbered steps). The card's left edge takes the risk colour.
  - The three lines: what the checks found (by level), how many warning signs (`# টি সতর্ক সংকেত`), and whether a case, khas, acquisition or mortgage is on record (from the evidence codes in `nextSteps.ts`).
  - If the risk check fails, the card shows the error with retry and still gives the generic steps, so no result ends without a next step (acceptance checklist §8).
- **Steps** (`features/result/nextSteps.ts`, pure and tested): LOW → confirm at the AC (Land) office, keep the report. MEDIUM → ask the seller about each sign, confirm at the office (an open case swaps in "ask for the case papers"). HIGH → do not pay or sign, take the report to the office, see a lawyer (an open case swaps the lawyer step for the case papers). Unknown → try again, ask the office. Wording follows the rules above: no "জাল", "প্রমাণিত", "অবৈধ"; every sentence under 20 words; the copy never says the plot is illegal, only what to check.
- **Sections** (`features/result/Section.tsx`): native `<details>`, summary ≥ 48 px, count chip in locale digits, body mounted only while open. Order: ভূমির তথ্য (open), মালিকানা, লেনদেন, নামজারি, মামলা ও দায়-দেনা, প্রমাণ. প্রমাণ opens by itself when there is evidence. `LandInfoCard` got a `bare` prop (no frame, no duplicate title) and no longer carries the risk chip: the badge lives in the verdict only.
- Test hooks: `section-toggle` (summary), `section-land|ownership|transactions|mutation|encumbrance|evidence` (details), `verdict`, `verdict-badge`, `verdict-summary`, `next-steps`. `e2e/fixtures.ts openEvidenceTab` opens the evidence section; the a11y jsdom case opens every section before running axe.
- Checked 2026-10-17 in the browser (bn, LP-10240 HIGH): verdict order, no horizontal scroll at 360 px with every section open, summaries 52 px tall. Not run: the Playwright suites (need the e2e database), EN browser walk, dark theme.
- Not in this task: "শুনুন" read-aloud (U4.4), the sticky bottom action bar polish (U5.1), the same verdict on the public `/verify` summary (it already shows the large badge; the steps there would need sign-in-free wording).
