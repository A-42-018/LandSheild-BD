// P54 — axe-core checks on the key pages, English and Bangla.
// jsdom has no layout engine, so `color-contrast` cannot run here (contrast is
// checked by the computed table in docs/ui.md). `region` / `landmark-one-main` /
// `page-has-heading-one` are page-level rules that cannot hold for a rendered
// fragment (the real <main>/<header> live in app/[locale]/layout.tsx).
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import bn from "../messages/bn.json";
import { type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import Navbar from "@/features/landing/Navbar";
import Footer from "@/features/landing/Footer";
import Hero from "@/features/landing/Hero";
import { HowItWorks, OfficerBand, ServiceTiles, Trust, WhatWeCheck } from "@/features/landing/Sections";
import VerifyForm from "@/features/verify/VerifyForm";
import ResultView from "@/features/result/ResultView";
import ReportView from "@/features/report/ReportView";
import LoginForm from "@/features/auth/LoginForm";
import ReviewView from "@/features/review/ReviewView";
import DashboardView from "@/features/officer/DashboardView";
import { FaqPage, SitemapPage, TextPage } from "@/features/info/InfoPage";
import OfficerShell from "@/features/officer/OfficerShell";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/officer",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/features/officer/ChartCanvas", () => ({
  default: ({ data }: { data: { key: string }[] }) => <div>{data.length}</div>,
}));

// ---------- axe helper ----------
const OFF = ["color-contrast", "region", "landmark-one-main", "page-has-heading-one"];

async function violations(node: HTMLElement) {
  const rules = Object.fromEntries(OFF.map((id) => [id, { enabled: false }]));
  const res = await axe.run(node, { rules, resultTypes: ["violations"] });
  return res.violations;
}

async function expectNoSeriousViolations(node: HTMLElement) {
  const found = await violations(node);
  const bad = found.filter((v) => v.impact === "serious" || v.impact === "critical");
  const text = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 120)).join(" | ")}`).join("\n");
  expect(text).toBe("");
  // moderate/minor findings are P2 for this phase but must not creep in either
  expect(found.map((v) => v.id)).toEqual([]);
}

// ---------- fixtures ----------
const mk = (role: string) => ({ id: "1", name: "U", email: "u@x.co", role, preferred_language: "en" });
const p = (name: string) => ({ name, father_name: null });
const land = (id: string) => ({
  land_id: id, district: "Dhaka", upazila: "Savar", mouza: "Ashulia", khatian_no: "610", dag_no: "210",
  area: 20, area_unit: "decimal", status: "ACTIVE", current_owners: [p("Hasan Ali")],
});
const own = (name: string, s: string, e: string | null, cur: boolean) => ({
  owner: p(name), start_date: s, end_date: e, is_current: cur, confidence: null, document: null,
});
const tx = (s: string, b: string, d: string, st = "RECORDED") => ({
  transaction_type: "SALE", transaction_date: d, seller: p(s), buyer: p(b), area: 20, area_unit: "decimal", status: st, document: null,
});
const EVIDENCE = [
  { code: "POSSIBLE_DUPLICATE_TRANSACTION", severity: "HIGH", params: { transaction_count: 2, total_area: 40, recorded_area: 20, area_unit: "decimal" } },
  { code: "SELLER_MISMATCH", severity: "HIGH", params: { transaction_date: "2019-07-01" } },
];
const OWNERSHIP = [own("Rahim Uddin", "2005-01-01", "2012-03-15", false), own("Hasan Ali", "2012-03-15", null, true)];
const TXS = [tx("Rahim Uddin", "Hasan Ali", "2012-03-15"), tx("Rahim Uddin", "Karim Mia", "2012-04-01", "FLAGGED")];

const REPORT = {
  verification_id: "v1", land_id: "LP-10240", verification_status: "COMPLETED", overall_status: "ACTIVE",
  disclaimer_code: "DEMO_DECISION_SUPPORT", verified_at: "2026-10-02T09:30:00Z",
  risk_score: 70, risk_level: "HIGH", land: land("LP-10240"), ownership: OWNERSHIP,
  document_consistency: {
    status: "INCONSISTENCIES_FOUND", total_documents: 2, by_status: { APPROVED: 2 },
    indicators: [{ code: "DUPLICATE_DEED", severity: "HIGH", params: { deed_no: "D-1", count: 2 } }],
  },
  transactions: TXS, evidence: EVIDENCE,
};

const FIELDS = ["owner_name", "father_name", "khatian_no", "dag_no", "mouza", "district", "upazila", "land_area", "area_unit", "deed_no", "deed_date", "seller", "buyer"];
const EXTRACTION = {
  document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "mock", threshold: 0.85,
  fields: FIELDS.map((f, i) => ({
    field: f, value: f === "khatian_no" ? "৫০১" : `v-${f}`, confidence: i % 3 === 0 ? 0.6 : 0.95,
    source_bbox: null, edited_by_human: i === 4, low_confidence: i % 3 === 0,
  })),
  edited_by_human: true, has_low_confidence: true, low_confidence_fields: ["owner_name"],
  validation: { valid: true, errors: [] }, original_fields: undefined,
};
const DOC = {
  id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z",
};
const ALERT = {
  id: "al-1", land_id: "LP-10500", alert_type: "DUPLICATE_DEED", severity: "HIGH", risk_score: 30,
  evidence: [{ code: "DUPLICATE_DEED", severity: "HIGH", params: { deed_no: "D-1", count: 2 } }],
  status: "OPEN", created_at: "2026-10-01T09:00:00Z",
};
const QUEUE = {
  items: [{
    id: "doc-1", land_id: "LP-10240", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
    min_confidence: 0.72, low_confidence: true, high_risk: true, created_at: "2026-10-01T08:00:00Z",
  }],
  total: 1, limit: 20, offset: 0,
};
const ACTIVITY = {
  items: [{ id: "a1", action: "DOCUMENT_APPROVE", entity_type: "document", actor: { name: "Olivia", role: "OFFICER" }, created_at: "2026-10-01T10:00:00Z" }],
  total: 1, limit: 8, offset: 0,
};

function get(path: string): Promise<any> {
  if (path.startsWith("/officer/stats")) return Promise.resolve({ total_records: 7, pending_review: 3, high_risk: 1, verified: 7 });
  if (path.startsWith("/officer/queue")) return Promise.resolve(QUEUE);
  if (path.startsWith("/officer/activity")) return Promise.resolve(ACTIVITY);
  if (path.startsWith("/risk-alerts")) return Promise.resolve({ items: [ALERT], total: 1, limit: 8, offset: 0 });
  if (path.startsWith("/verification/")) return Promise.resolve(REPORT);
  if (path.endsWith("/extraction")) return Promise.resolve(EXTRACTION);
  if (path.startsWith("/documents/")) return Promise.resolve(DOC);
  if (path.endsWith("/risk")) return Promise.resolve({ land_id: "LP-10240", overall_score: 70, risk_level: "HIGH", rule_score: 70, ml_score: null, evidence: EVIDENCE, assessed_at: "2026-10-01T10:00:00Z" });
  if (path.endsWith("/ownership")) return Promise.resolve({ entries: OWNERSHIP });
  if (path.endsWith("/mutations")) return Promise.resolve({ land_id: "LP-10240", mutations: [{ mutation_no: "M-1", status: "APPROVED", applied_at: "2026-01-05T04:00:00Z", decided_at: "2026-01-20T04:00:00Z", previous_khatian_no: "501", new_khatian_no: "612", ac_land_office: "Savar AC Land" }] });
  if (path.endsWith("/transactions")) return Promise.resolve({ transactions: TXS });
  if (path.startsWith("/lands/")) return Promise.resolve(land("LP-10240"));
  return Promise.reject(new Error(`unmocked ${path}`));
}

const client = (role: string | null): ApiClient =>
  ({
    refresh: role ? vi.fn().mockResolvedValue({ user: mk(role) }) : vi.fn().mockRejectedValue(new Error("anon")),
    get: vi.fn(get),
    blob: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" })),
  }) as unknown as ApiClient;

function page(ui: React.ReactNode, loc: "en" | "bn", role: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={loc} messages={loc === "en" ? en : bn}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client(role)}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  window.localStorage.clear();
});

type Case = { name: string; role: string | null; ui: () => React.ReactNode; ready: (m: typeof en) => Promise<unknown> | unknown };

const CASES: Case[] = [
  {
    name: "home",
    role: "OFFICER",
    ui: () => (
      <>
        <Navbar />
        <main id="main">
          <Hero />
          <ServiceTiles />
          <WhatWeCheck />
          <HowItWorks />
          <OfficerBand />
          <Trust />
        </main>
        <Footer />
      </>
    ),
    ready: (m) => screen.findByRole("link", { name: m.landing.ctaUpload }),
  },
  {
    name: "verify",
    role: "CITIZEN",
    ui: () => <main><VerifyForm /></main>,
    ready: (m) => screen.findByRole("button", { name: new RegExp(m.verify.submit) }),
  },
  {
    name: "result",
    role: "CITIZEN",
    ui: () => <main><ResultView landId="LP-10240" /></main>,
    ready: (m) => screen.findByText(m.result.ownership),
  },
  {
    name: "report",
    role: "CITIZEN",
    ui: () => <main><ReportView id="v1" /></main>,
    ready: () => screen.findByTestId("report-summary"),
  },
  {
    name: "login",
    role: null,
    ui: () => <main><LoginForm /></main>,
    ready: (m) => screen.findByRole("button", { name: m.auth.submit }),
  },
  {
    name: "review",
    role: "REVIEWER",
    ui: () => <main><ReviewView id="d1" /></main>,
    ready: () => screen.findAllByText(/v-owner_name/),
  },
  {
    name: "dashboard",
    role: "OFFICER",
    ui: () => (
      <OfficerShell>
        <DashboardView />
      </OfficerShell>
    ),
    ready: () => screen.findByTestId("kpi-pending_review"),
  },
  ...(["faq", "accessibility", "privacy", "terms", "dataSources", "sitemap"] as const).map((ns): Case => ({
    name: `info-${ns}`,
    role: null,
    ui: () => (
      <main>
        {ns === "faq" ? <FaqPage /> : ns === "sitemap" ? <SitemapPage /> : <TextPage slug={ns === "dataSources" ? "data-sources" : ns} />}
      </main>
    ),
    ready: (m) => screen.findByRole("heading", { level: 1, name: m.info[ns].title }),
  })),
];

describe("axe — no violations on key pages (P54)", () => {
  for (const loc of ["en", "bn"] as const) {
    for (const c of CASES) {
      it(`${c.name} (${loc})`, async () => {
        const { container } = page(c.ui(), loc, c.role);
        await c.ready(loc === "en" ? en : (bn as typeof en));
        // let secondary queries (risk card, alerts, activity) settle
        await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 3000 }).catch(() => {});
        await expectNoSeriousViolations(container);
      });
    }
  }
});

describe("axe harness sanity", () => {
  it("does detect a real violation (so the green results above mean something)", async () => {
    const { container } = render(
      <div>
        <img src="x.png" />
        <button />
        <input />
      </div>,
    );
    const ids = (await violations(container)).map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(["image-alt", "button-name", "label"]));
  });
});

describe("touch-target contract (P54)", () => {
  it("shared controls are 44 px tall and globals.css has the coarse-pointer net", async () => {
    const { readFileSync } = await import("node:fs");
    const read = (f: string) => readFileSync(`${process.cwd()}/${f}`, "utf8");
    for (const f of ["components/ui/Button.tsx", "components/ui/Input.tsx", "components/ui/Select.tsx", "components/ui/Tabs.tsx"]) {
      expect(read(f), f).toContain("min-h-11");
    }
    const css = read("app/globals.css");
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*min-height: 44px/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
