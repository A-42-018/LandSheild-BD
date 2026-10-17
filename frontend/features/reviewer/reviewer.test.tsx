import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ReviewToolbar from "@/features/review/ReviewToolbar";
import { ageBand, ageDays } from "./ageing";
import ReviewerHome from "./ReviewerHome";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/officer/review",
  useRouter: () => ({ replace: vi.fn(), push }),
}));

const reviewer = { id: "1", name: "R", email: "r@x.co", role: "REVIEWER", preferred_language: "en" };
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000 - 3_600_000).toISOString();
const item = (id: string, days: number, over: any = {}) => ({
  id, land_id: `LP-${id}`, document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  min_confidence: 0.9, low_confidence: false, high_risk: false, created_at: daysAgo(days), ...over,
});
const QUEUE = { items: [item("a", 9, { low_confidence: true }), item("b", 4), item("c", 1), item("d", 0)], total: 4, limit: 50, offset: 0 };
const HISTORY = {
  items: [
    { id: "h1", document_id: "x1", land_id: "LP-1", document_type: "DEED", decision: "REJECTED", reason: "Blurry scan", created_at: daysAgo(1) },
    { id: "h2", document_id: "x2", land_id: "LP-2", document_type: "DEED", decision: "APPROVED", reason: null, created_at: daysAgo(2) },
  ],
  total: 2, limit: 10, offset: 0,
};

function mount(ui: React.ReactElement, opts: { queue?: any; history?: any; locale?: "en" | "bn" } = {}) {
  const get = vi.fn((path: string) =>
    Promise.resolve(path.startsWith("/officer/queue") ? (opts.queue ?? QUEUE) : path.startsWith("/officer/my-decisions") ? (opts.history ?? HISTORY) : {}),
  );
  const api = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const locale = opts.locale ?? "en";
  const view = render(
    <NextIntlClientProvider locale={locale} messages={locale === "bn" ? bn : en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={api}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { get, ...view };
}

beforeEach(() => push.mockClear());

describe("age bands", () => {
  it("splits at 2 and 7 days", () => {
    expect([0, 2, 3, 7, 8].map(ageBand)).toEqual(["fresh", "fresh", "aging", "aging", "late"]);
  });
  it("counts whole days and never goes negative", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    expect(ageDays("2026-10-14T13:00:00Z", now)).toBe(2);
    expect(ageDays("2026-10-18T00:00:00Z", now)).toBe(0);
    expect(ageDays("garbage", now)).toBe(0);
  });
});

describe("ReviewerHome", () => {
  it("asks for the pending queue oldest first and shows the count", async () => {
    const { get } = mount(<ReviewerHome />);
    expect(await screen.findByTestId("pending-count")).toHaveTextContent("4 documents waiting");
    expect(get).toHaveBeenCalledWith("/officer/queue?filter=pending&sort=created_at&order=asc&limit=50");
  });

  it("colours each row by waiting time with a word, not colour alone", async () => {
    mount(<ReviewerHome />);
    const rows = await screen.findAllByTestId("today-row");
    expect(rows).toHaveLength(4);
    const bands = rows.map((r) => r.querySelector("[data-band]")?.getAttribute("data-band"));
    expect(bands).toEqual(["late", "aging", "fresh", "fresh"]);
    expect(within(rows[0]).getByText("9 days")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Today")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Check fields")).toBeInTheDocument();
  });

  it("starts with the oldest document", async () => {
    mount(<ReviewerHome />);
    expect(await screen.findByTestId("start-oldest")).toHaveAttribute("href", "/officer/review/a");
  });

  it("says so when nothing is waiting", async () => {
    mount(<ReviewerHome />, { queue: { items: [], total: 0, limit: 50, offset: 0 } });
    expect(await screen.findByText(en.reviewer.queue.emptyTitle)).toBeInTheDocument();
    expect(screen.getByTestId("pending-count")).toHaveTextContent("Nothing waiting");
    expect(screen.queryByTestId("start-oldest")).toBeNull();
  });

  it("lists my decisions with the reason for each rejection", async () => {
    mount(<ReviewerHome />);
    const table = await screen.findByTestId("history-table");
    expect(await within(table).findByText("Blurry scan")).toBeInTheDocument();
    expect(within(table).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/officer/review/x1", "/officer/review/x2"]);
  });

  it("uses Bangla digits for the count and ages", async () => {
    mount(<ReviewerHome />, { locale: "bn" });
    expect(await screen.findByTestId("pending-count")).toHaveTextContent("অপেক্ষায় আছে ৪টি নথি");
    expect((await screen.findAllByTestId("today-row"))[0]).toHaveTextContent("৯ দিন");
  });

  it("has no axe violations", async () => {
    const { container } = mount(<ReviewerHome />);
    await screen.findAllByTestId("today-row");
    await screen.findByText("Blurry scan");
    const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } }, resultTypes: ["violations"] });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("ReviewToolbar", () => {
  it("N opens the next document in the queue", async () => {
    mount(<ReviewToolbar id="b" />);
    await screen.findByTestId("next-btn");
    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    expect(push).toHaveBeenCalledWith("/officer/review/c");
  });

  it("wraps to the oldest other document from the last one", async () => {
    mount(<ReviewToolbar id="d" />);
    fireEvent.click(await screen.findByTestId("next-btn"));
    expect(push).toHaveBeenCalledWith("/officer/review/a");
  });

  it("ignores N while typing, with Ctrl held, and in a dialog", async () => {
    mount(
      <>
        <ReviewToolbar id="b" />
        <input aria-label="note" />
      </>,
    );
    await screen.findByTestId("next-btn");
    fireEvent.keyDown(screen.getByLabelText("note"), { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyN", key: "n", ctrlKey: true });
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    document.body.appendChild(dlg);
    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    dlg.remove();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("next-btn")).toBeInTheDocument());
  });

  it("says the queue is clear when this is the only document", async () => {
    mount(<ReviewToolbar id="a" />, { queue: { items: [item("a", 1)], total: 1, limit: 50, offset: 0 } });
    expect(await screen.findByTestId("queue-clear")).toHaveTextContent(en.review.toolbar.noNext);
  });
});
