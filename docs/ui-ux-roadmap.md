# LandShield BD — UI/UX Upgrade Roadmap (নাগরিকবান্ধব রূপান্তর)

Date: 16 Oct 2026 · Status: plan only, no code changed · Owner: DEEDGUARD

Mentor brief: anyone, including a first-time internet user, should be able to use the site without help. Native Bangla
first, features easy to understand, citizen tools easy to reach, and a separate screen set for each role.

This roadmap is based on the homepages of eight Ministry of Land systems (e-Mutation, LD Tax, DLRMS khatian & map,
LARMS acquisition, Ijara, revenue case management, 16122 grievance and help desk, Bhumi Naksha map) compared with
the current LandShield build (`frontend/app/[locale]/*`, `features/auth/roles.ts`, `backend/app/core/rbac.py`).

---

## 1. What the government sites do well (patterns to adopt)

| # | Pattern | Seen on | Why citizens find it easy |
|---|---|---|---|
| P1 | **Search on the homepage, no login** (division + application no.; division → district → upazila → mouza cascade) | e-Mutation, DLRMS, Bhumi Naksha, case management | The first thing a citizen wants is one click away |
| P2 | **2–5 large icon tiles** with a short Bangla label (ভূমি উন্নয়ন কর প্রদান, নির্দেশিকা, টিউটোরিয়াল) | LD Tax, DLRMS, 16122 | Understood from the picture, not the text |
| P3 | **Tabbed search card**: one card, tabs for each service (সার্ভে খতিয়ান / নামজারি খতিয়ান / মৌজা ম্যাপ / আবেদনের অবস্থা) | DLRMS | One place to start, nothing to hunt for |
| P4 | **Top date strip in Bangla**: বঙ্গাব্দ + খ্রিস্টাব্দ, Bangla numerals, **বাং \| EN** pill | LD Tax, DLRMS, Ijara | Familiar government feel, right language from the start |
| P5 | **"লগইন ▾" dropdown** that asks *who you are* (নাগরিক / কর্মকর্তা) | LD Tax, DLRMS, 16122 | Users never land on the wrong login form |
| P6 | **তথ্যচিত্র (public statistics)**: KPI cards, division map, division table, "সর্বশেষ হালনাগাদ" timestamp | e-Mutation, DLRMS, case management | Builds trust and shows the service is in use |
| P7 | **Notice ticker + dated notice list** (নোটিশ) | LD Tax, DLRMS, LARMS, case management | Changes and warnings are visible right away |
| P8 | **FAQ accordion** (সাধারণ জিজ্ঞাসা) with a "আরও" button | LD Tax, case management | Answers questions without a phone call |
| P9 | **Hotline 16122** shown prominently, plus a floating help/chat button | LARMS, 16122, DLRMS | A way out when stuck |
| P10 | **Hearing calendar** with division/district filter | Case management | Dates are clear at a glance |
| P11 | **Standard footer**: গুরুত্বপূর্ণ লিংক · পরিকল্পনা ও বাস্তবায়নে · অ্যাপ ডাউনলোড · সামাজিক যোগাযোগ · কারিগরি সহায়তায় | All | Predictable place for every secondary link |
| P12 | Accessibility button (♿) | Bhumi Naksha | Signals inclusion |
| P13 | Extreme simplicity: hero + exactly two choices | 16122 | Zero learning curve |
| P14 | **Nakshi kantha background**: faint dashed "running stitch" folk line art (trees, flowers, village scenes) behind a solid content column, plus a village → city silhouette strip above the footer | Case management | Feels Bangladeshi at first glance; the strip quietly tells a "rural to digital" story |

## 2. Where the government sites fall short (where we can do better)

- Mixed numerals and language: English calendar (Sun/Mon/Today), English dropdown placeholders, "Search Menu".
- Small text (12–13 px) and low contrast tables; hard for older users and on cheap phones.
- Dense 10-column tables on mobile, with no card view.
- Placeholder pages ("নির্মাণ কাজ চলমান", Ijara). Never ship an empty page.
- No progress stepper: status is shown as text, not as a clear "you are here".
- No plain-language explanation of results, and no "what should I do next?"
- Every system looks different. We should keep **one** consistent design system.

## 3. Where LandShield stands today (gap analysis)

| Area | Current state | Gap |
|---|---|---|
| Language | `defaultLocale: "bn"`; bn.json and en.json at parity (1,898 lines); Bangla copy mostly good | Brand shows as "LANDSHIELD BD" (Latin); "ধাপ 1" uses Latin digits; jargon (QR, OCR, হ্যাশ, স্কোর, পয়েন্ট) shown to citizens; no Bangla date strip |
| Public access | `/verify`, `/check`, `/map` and every `/lands/*`, `/verification`, `/map` API need sign-in (`ANY_AUTH`) | Biggest gap compared with P1. A citizen must create an account before seeing anything useful |
| Homepage | Hero with no button or search (a test requires that); 4 service cards below | Matches P2 but misses P1/P3: no search on the homepage |
| Login | One login page; officer signup on a separate URL | No "who are you?" choice (P5) |
| Citizen role | No citizen home. After login the user gets the same public pages | No "আমার" area (my searches, reports, saved parcels, applications, notifications) |
| Reviewer / Officer / Admin | All share `/officer` (`OfficerShell`); the sidebar only hides items by role | Every role lands on the same dashboard. A reviewer's job (clear the queue) and an admin's job (users, offices, notices) are different screens |
| Notices | Notice board is static sample text | No admin screen to publish notices/FAQ |
| Help | FAQ and feedback pages exist | No hotline, no floating help, no per-page "এই পাতায় কী করবেন" guide |
| Statistics | Officer dashboard only | No public তথ্যচিত্র (P6) |
| Accessibility | `/accessibility` page, focus rings, dark mode | No text-size control, no high-contrast toggle, no read-aloud |

---

## 4. Target information architecture (role-based screens)

### 4.1 Public: no login (সবার জন্য)

| Screen (Bangla label) | Route | Notes |
|---|---|---|
| হোম | `/` | Date strip → hero with **tabbed search card** → service tiles → নাগরিক টুলস → তথ্যচিত্র → নোটিশ → সাধারণ জিজ্ঞাসা → footer |
| জমি খুঁজুন (সংক্ষিপ্ত ফল) | `/verify` | **Make public.** Show a *masked summary*: parcel found, number of recorded owners (names masked "মো. র*** হ***"), risk level badge, open cases yes/no. Full details and the PDF report need login |
| নামজারির অবস্থা | `/track` | Already public. Add a visual stepper (আবেদন → যাচাই → শুনানি → সিদ্ধান্ত) |
| দলিল / QR যাচাই | `/verify-document`, `/v/[id]` | Already public. Add a "ক্যামেরা দিয়ে QR স্ক্যান করুন" button for mobile |
| জমির মানচিত্র | `/map` | Public view with polygons and parcel numbers only, no owner data |
| নাগরিক টুলস | `/tools/*` | Already public. Promote to the homepage and the header |
| নির্দেশিকা ও ভিডিও | `/guide` (new) | Step-by-step pictures for each service and short videos (P2) |
| সাধারণ জিজ্ঞাসা, নোটিশ, যোগাযোগ, মতামত | existing + `/notices` (new) | |

### 4.2 নাগরিক (CITIZEN): after login → `/my` (new "আমার ভূমি সেবা" area)

| Screen | Purpose |
|---|---|
| আমার ড্যাশবোর্ড | Greeting, 3 big buttons (জমি যাচাই, কেনার আগে যাচাই, নামজারির অবস্থা), recent activity |
| আমার অনুসন্ধান | History of parcel searches; re-open the result in one tap |
| সংরক্ষিত জমি (নজরে রাখা) | Watch a parcel; alert when a new transaction, case or mutation appears |
| আমার প্রতিবেদন | All generated reports, download PDF, share QR |
| কেনার আগে যাচাই (পূর্ণ) | Full checklist with "এখন আপনার করণীয়" for each red or yellow item |
| বিজ্ঞপ্তি | Inbox (also a bell icon in the header) |
| প্রোফাইল ও নিরাপত্তা | Name, phone, password, language preference |

### 4.3 পর্যালোচক (REVIEWER): after login → `/officer/review` as home ("আজকের কাজ")

- One screen whose main job is the **queue**: oldest first, colour by waiting time (≤ 2 days / 3–7 / > 7), count badge.
- Review screen: document image on the left, extracted fields on the right, low-confidence fields highlighted, keyboard
  shortcuts (A = অনুমোদন, R = বাতিল, N = পরবর্তী).
- "আমার পর্যালোচনা ইতিহাস" (my decisions, with a reason for each rejection).
- Hidden from the reviewer: upload, admin, office-wide alerts.

### 4.4 কর্মকর্তা (OFFICER): after login → `/officer` ("অফিস ড্যাশবোর্ড")

- KPI cards for **my office**: অপেক্ষমাণ পর্যালোচনা, ঝুঁকি সতর্কতা, নামজারি সিদ্ধান্ত বাকি, এই মাসে নিষ্পত্তি.
- ডকুমেন্ট আপলোড (multi-file, drag and drop, phone camera).
- নামজারি সিদ্ধান্ত: list → detail → decision with a reason template.
- **শুনানির ক্যালেন্ডার** (new, P10): hearings by date with a Bangla calendar (রবি/সোম…, Bangla numerals).
- ঝুঁকি সতর্কতা: alerts with evidence and "dismiss with reason".
- নাগরিক মতামত, অডিট লগ (office scope).

### 4.5 প্রশাসক (ADMIN): after login → `/admin` (move out of `/officer/admin`)

- System overview: users by role, offices, documents by status, ledger health (hash chain OK / broken).
- ব্যবহারকারী ও ভূমিকা, কর্মকর্তা নিবন্ধনের অনুরোধ (approve/reject), অফিস ব্যবস্থাপনা.
- **কনটেন্ট ব্যবস্থাপনা** (new): notices (with a ticker flag), FAQ, guide pages. All Bangla first, English optional.
- অডিট লগ (all offices), সিস্টেম সেটিংস.

### 4.6 Login flow

Header button **"লগইন ▾"** opens a menu with two choices: **নাগরিক লগইন** and **কর্মকর্তা লগইন**. Each opens its own page,
with its own copy and a different registration link. After login, `redirectFor(role)` sends the user to their home:
CITIZEN → `/my`, REVIEWER → `/officer/review`, OFFICER → `/officer`, ADMIN → `/admin`.

---

## 5. Design system rules (applied everywhere)

**Language**
- Bangla is the default and the source text; English is the translation, not the other way round.
- Bangla numerals everywhere in BN (dates, counts, steps, money, table numbers), using `Intl.NumberFormat("bn-BD")`. Add a
  lint/test that fails on Latin digits in `bn.json` values (except placeholders).
- Brand: show **"ল্যান্ডশিল্ড বিডি"** in BN, with a tagline "ডিজিটাল ভূমি যাচাই".
- Plain-word glossary, enforced in review:

  | Avoid (citizen-facing) | Use |
  |---|---|
  | রিস্ক স্কোর ৭০ | ঝুঁকি: **উচ্চ** (লাল) — "সাবধান, কেনার আগে ভূমি অফিসে যাচাই করুন" |
  | OCR / এক্সট্র্যাকশন | দলিল থেকে তথ্য পড়া |
  | হ্যাশ / স্বাক্ষর | ডিজিটাল সিল |
  | এনকাম্ব্রান্স | দায়-দেনা (মামলা, বন্ধক, খাস, অধিগ্রহণ) |
  | স্ট্যাটাস | অবস্থা |

- Every result ends with **"এখন আপনার করণীয়"**: 1–3 concrete next steps.
- Plain-language rule of thumb: sentences under 20 words, one idea per sentence.

**Visual**
- Colour: government green as primary (≈ `#006A4E` family), white surfaces, red only for "উচ্চ ঝুঁকি"/errors, gold
  accent kept sparingly. Risk always shown with colour **plus** an icon **plus** a word (never colour alone).
- Font: Noto Sans Bengali / Hind Siliguri; body text 17–18 px for Bangla, line-height 1.7; headings 600 weight.
- Touch targets ≥ 48 px; one primary button per screen.
- Big icon tiles (P2) for every service entry point; each icon also has a text label.
- Tables collapse into cards below 640 px.
- Status always as a **stepper**, never as plain text.

**Bangladeshi visual identity (P14)**
- Background: our own nakshi kantha-style line art (paddy field, boat, hut, banyan tree, land plot, mouza grid) drawn as
  dashed strokes at 5–8 % opacity, added as a layer in `features/landing/Backdrop.tsx` next to the existing contours.
  Fades down the page with a CSS mask; uses theme tokens so dark mode works.
- Footer strip: silhouette from village → town → land office, in brand green, sitting just above the footer.
- Rules: original artwork only (no copying the ministry's art); lighter than the government version; text always sits
  on solid cards, never directly on the pattern; inline SVG pattern tile (< 10 KB); `aria-hidden`, `pointer-events-none`,
  `print:hidden`; decoration never carries meaning.

**Do not imitate the government**: no government seal, no "ভূমি মন্ত্রণালয়" branding, keep the "ডেমো — সরকারি রেকর্ড নয়"
ribbon. We borrow the *layout patterns*, not the identity.

**Accessibility (WCAG 2.2 AA)**
- Header toolbar: **অ− অ অ+** (text size), high-contrast toggle, theme toggle.
- "শুনুন" (read aloud) button on results and guides using the browser's Bangla speech synthesis where available.
- Every form field has a visible Bangla label and an example (যেমন: ১২৩৪).
- Error messages say what went wrong **and** how to fix it.

---

## 6. Phased roadmap

Effort: S ≈ ½–1 day, M ≈ 2–3 days, L ≈ 4–6 days (2-person team).

### Phase 0 — Foundations (week 1)
| ID | Task | Effort |
|---|---|---|
| U0.1 | Bangla copy audit of `bn.json`: Latin digits, jargon, sentence length; write a glossary in `docs/ui.md` | M |
| U0.2 | `bn` number/date helpers + test that fails on Latin digits in bn strings | S |
| U0.3 | Design tokens: green palette, Bangla type scale, 48 px targets, risk colour+icon+word component | M |
| U0.4 | Run 5 baseline usability tests (see §7) on the current build to get "before" numbers | S |

### Phase 1 — Header, login, homepage (weeks 2–3) · *highest visible impact*
| ID | Task | Pattern | Effort |
|---|---|---|---|
| U1.1 | Top strip: Bangla date (বঙ্গাব্দ + খ্রিস্টাব্দ), বাং \| EN pill, text-size and contrast controls | P4, P12 | M |
| U1.2 | Header: Bangla brand, nav হোম · সেবাসমূহ ▾ · নাগরিক টুলস · নির্দেশিকা · নোটিশ · যোগাযোগ, "লগইন ▾" (নাগরিক / কর্মকর্তা) | P5 | M |
| U1.3 | Hero with **tabbed search card**: জমি খুঁজুন (বিভাগ → জেলা → উপজেলা → মৌজা → খতিয়ান/দাগ) · নামজারির অবস্থা · দলিল/QR যাচাই. Update the landing test that forbids a form in the hero | P1, P3 | L |
| U1.4 | Notice ticker under the header + dated notice list section | P7 | S |
| U1.5 | Homepage FAQ accordion (top 5) + "আরও" | P8 | S |
| U1.6 | Hotline/help strip and floating "সাহায্য" button (FAQ, guide, feedback) | P9 | S |
| U1.7 | Footer reorganised into the standard gov columns (P11), with a "ডেমো প্রকল্প" note in place of ministry credits | P11 | S |
| U1.8 | Bangladeshi visual identity: nakshi kantha stitch layer in the page backdrop + village → city silhouette strip above the footer (rules in §5) | P14 | M |

### Phase 2 — Public access with privacy (weeks 3–4) · *removes the biggest barrier*
| ID | Task | Effort |
|---|---|---|
| U2.1 | Backend: new public endpoint `GET /public/lands/search` returning a **masked summary** (no names in full, no NID/father's name), rate-limited | M |
| U2.2 | `/verify` becomes public: summary card + "পূর্ণ প্রতিবেদন দেখতে লগইন করুন" | M |
| U2.3 | Public `/map` with geometry and parcel numbers only | S |
| U2.4 | Result redesign: big risk badge → 3-line summary → "এখন আপনার করণীয়" → details in collapsible sections | M |
| U2.5 | `/track` stepper + SMS-style plain status sentence | S |

### Phase 3 — Role-based screens (weeks 5–7)
| ID | Task | Effort |
|---|---|---|
| U3.1 | `redirectFor(role)` after login; separate citizen and officer login pages | S |
| U3.2 | Citizen area `/my`: dashboard, search history, saved parcels, reports, notifications, profile (needs `search_history`, `watchlist`, `notifications` tables) | L |
| U3.3 | Reviewer home "আজকের কাজ": queue with age colours, side-by-side review, keyboard shortcuts, my history | M |
| U3.4 | Officer office dashboard (office-scoped KPIs) + **Bangla hearing calendar** | L |
| U3.5 | Admin moved to `/admin` with its own shell: overview, users, officer requests, offices, audit, settings | M |
| U3.6 | Admin content management for notices, FAQ and guides (replaces static notice text) | M |
| U3.7 | Role-aware header: bell icon, role badge in Bangla (নাগরিক / পর্যালোচক / কর্মকর্তা / প্রশাসক), "আমার ড্যাশবোর্ড" shortcut | S |

### Phase 4 — Help and trust (week 8)
| ID | Task | Effort |
|---|---|---|
| U4.1 | `/guide`: picture-based step guides for every service + short screen-recorded videos (Bangla voice-over) | M |
| U4.2 | Per-page "এই পাতায় কী করবেন?" collapsible tip (3 bullets) | S |
| U4.3 | Public তথ্যচিত্র: KPI cards, division map, division table, "সর্বশেষ হালনাগাদ" (clearly labelled as demo data) | M |
| U4.4 | "শুনুন" read-aloud on results and guides | S |
| U4.5 | Empty, loading and error states written in plain Bangla on every screen; no "under construction" pages | S |

### Phase 5 — Mobile and polish (week 9)
| ID | Task | Effort |
|---|---|---|
| U5.1 | Mobile pass at 360 px: tables → cards, sticky bottom action bar on result/review, QR camera scan | M |
| U5.2 | PWA basics (installable, offline guide pages) for low-bandwidth users | M |
| U5.3 | Performance budget: homepage < 200 KB JS on 3G, compressed hero image | S |
| U5.4 | Accessibility audit (axe + keyboard + screen reader with Bangla) and fixes | M |

### Phase 6 — Validate (week 10)
- Repeat the §7 usability tests with the same tasks and compare against the Phase 0 numbers.
- Show before/after numbers and screenshots to the mentor.

---

## 7. Usability testing plan

**Participants (5–8):** a farmer or rural landowner, an elderly user (60+), a first-time land buyer, a smartphone-only
user with low literacy, a law/land-office student acting as a reviewer.

**Tasks:**
1. "এই খতিয়ান নম্বরের জমির মালিক কে, জমিতে কোনো মামলা আছে কি?" (public search)
2. "আপনার নামজারি আবেদন কোন ধাপে আছে?" (track)
3. "১০ শতাংশ জমি কত কাঠা?" (unit tool)
4. "এই দলিলের QR কোডটি আসল কি না যাচাই করুন।"
5. Reviewer: approve one document and reject one with a reason.

**Measures:** task success rate (target ≥ 90 %), time on task, number of wrong clicks, SUS score (target ≥ 75),
and quotes about words they did not understand (feed back into the glossary).

---

## 8. Acceptance checklist (definition of done for this roadmap)

- [ ] A visitor can search a parcel, track a mutation and verify a QR **without logging in**, from the homepage.
- [ ] No Latin digits or untranslated jargon in the Bangla UI (automated check passes).
- [ ] Each of the 4 roles lands on its own home screen and sees only its own menu.
- [ ] Every result shows "এখন আপনার করণীয়".
- [ ] Every page works at 360 px with no horizontal scroll and 48 px touch targets.
- [ ] Notices and FAQ editable by admin, no code change needed.
- [ ] WCAG 2.2 AA audit passes; text-size control works on every page.
- [ ] Usability test success ≥ 90 % and SUS ≥ 75.

## 9. Risks and guardrails

- **Privacy when opening public search**: mask names, never show NID or father's name publicly, rate-limit, and log access.
  Keep the backend role checks for full data (`_SEES_FATHER`).
- **Looking official**: no government seal or ministry name; keep the demo ribbon and disclaimer on every result.
- **Scope**: the citizen area (U3.2) and hearing calendar (U3.4) are the largest items; cut them first if time runs out.
  Phases 1–2 alone deliver most of what the mentor asked for.
- **Existing tests**: the landing test that forbids a hero form, role-wiring tests and i18n parity checks must be updated
  in the same change as each UI change.
