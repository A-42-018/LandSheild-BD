import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { OFFICER_NAV } from "@/features/officer/OfficerShell";
import { currentMonth, dhakaDay, monthGrid, shiftMonth, toHearingIso, weekdayNames } from "./calendar";
import HearingCalendar from "./HearingCalendar";
import HearingPanel from "./HearingPanel";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/officer/hearings",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const officer = { id: "1", name: "O", email: "o@x.co", role: "OFFICER", preferred_language: "en" };
const item = (id: string, no: string, hearing_at: string | null, over: any = {}) => ({
  id, mutation_no: no, land_id: `LP-${id}`, status: "HEARING", fast_track: false, applicant: `Applicant ${id}`,
  area: 1, area_unit: "decimal", applied_at: "2026-10-01T00:00:00Z", status_changed_at: "2026-10-01T00:00:00Z",
  decided_at: null, source: "WORKFLOW", hearing_at, ...over,
});
// Dhaka is UTC+6: 2026-10-17 05:00Z is 11:00 on Saturday 17 October.
const NOW = "2026-10-17T05:00:00Z";
const CAL = {
  month: "2026-10",
  items: [
    item("a", "MUT-2026-0001", "2026-10-17T04:00:00Z"), // 10:00 Dhaka
    item("b", "MUT-2026-0002", "2026-10-17T08:30:00Z"), // 14:30 Dhaka
    item("c", "MUT-2026-0003", "2026-10-20T18:30:00Z"), // 00:30 on the 21st in Dhaka
  ],
  unscheduled: [item("d", "MUT-2026-0004", null)],
};

function mount(ui: React.ReactElement, opts: { cal?: any; locale?: "en" | "bn"; post?: any } = {}) {
  const get = vi.fn((path: string) => Promise.resolve(path.startsWith("/mutations/hearings") ? (opts.cal ?? CAL) : []));
  const post = vi.fn().mockResolvedValue(opts.post ?? {});
  const api = { refresh: vi.fn().mockResolvedValue({ user: officer }), get, post } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const locale = opts.locale ?? "en";
  const view = render(
    <NextIntlClientProvider locale={locale} messages={locale === "bn" ? bn : en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={api}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { get, post, ...view };
}

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date(NOW) }));
afterEach(() => vi.useRealTimers());

describe("calendar helpers", () => {
  it("reads a day in Bangladesh time", () => {
    expect(dhakaDay("2026-10-20T18:30:00Z")).toBe("2026-10-21");
    expect(dhakaDay("2026-10-17T05:00:00Z")).toBe("2026-10-17");
    expect(currentMonth(Date.parse("2026-10-31T19:00:00Z"))).toBe("2026-11");
  });
  it("shifts months across a year end", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("builds full Sunday-first weeks", () => {
    const g = monthGrid("2026-10"); // 1 October 2026 is a Thursday
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0][0].date).toBe("2026-09-27");
    expect(g[0][4]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(31);
  });
  it("names the week from রবি", () => {
    expect(weekdayNames("bn")[0]).toBe("রবি");
    expect(weekdayNames("bn")[1]).toBe("সোম");
    expect(weekdayNames("en")[0]).toBe("Sun");
  });
  it("sends the hearing time with the +06:00 offset", () => {
    expect(toHearingIso("2026-10-21", "09:30")).toBe("2026-10-21T09:30:00+06:00");
  });
  it("is in the officer menu, not the reviewer's", () => {
    const nav = OFFICER_NAV.find((n) => n.href === "/officer/hearings");
    expect(nav?.roles).toEqual(["OFFICER", "ADMIN"]);
  });
});

describe("HearingCalendar", () => {
  it("shows the month with counts and the day's cases, oldest time first", async () => {
    const { get } = mount(<HearingCalendar />);
    const day = await screen.findByTestId("day-2026-10-17");
    expect(day).toHaveAttribute("data-count", "2");
    expect(screen.getByTestId("day-2026-10-21")).toHaveAttribute("data-count", "1"); // Dhaka date, not UTC
    expect(screen.getByTestId("day-2026-10-20")).toHaveAttribute("data-count", "0");
    expect(get).toHaveBeenCalledWith("/mutations/hearings?month=2026-10");
    const panel = screen.getByTestId("cal-day");
    expect(within(panel).getAllByRole("link").map((a) => a.textContent)).toEqual(["MUT-2026-0001", "MUT-2026-0002"]);
    expect(within(panel).getAllByTestId("hearing-time")[0].textContent).toMatch(/10:00/);
  });

  it("opens another day when it is clicked", async () => {
    mount(<HearingCalendar />);
    fireEvent.click(await screen.findByTestId("day-2026-10-21"));
    const panel = screen.getByTestId("cal-day");
    expect(within(panel).getAllByRole("link").map((a) => a.textContent)).toEqual(["MUT-2026-0003"]);
    expect(screen.getByTestId("day-2026-10-21")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("day-2026-10-05"));
    expect(screen.getByText("No hearings on this day.")).toBeInTheDocument();
  });

  it("lists cases without a date", async () => {
    mount(<HearingCalendar />);
    const list = await screen.findByTestId("cal-unscheduled");
    expect(within(list).getByText("MUT-2026-0004")).toBeInTheDocument();
  });

  it("asks for the next month", async () => {
    const { get } = mount(<HearingCalendar />);
    await screen.findByTestId("day-2026-10-17");
    fireEvent.click(screen.getByTestId("cal-next"));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/mutations/hearings?month=2026-11"));
    fireEvent.click(screen.getByTestId("cal-today"));
    await waitFor(() => expect(screen.getByTestId("day-2026-10-17")).toBeInTheDocument());
  });

  it("is in Bangla with Bangla digits and রবি first", async () => {
    mount(<HearingCalendar />, { locale: "bn" });
    const day = await screen.findByTestId("day-2026-10-17");
    expect(day.textContent).toBe("১৭২");
    expect(screen.getByText("রবি")).toBeInTheDocument();
    const grid = screen.getByTestId("cal-grid");
    expect(grid.textContent).not.toMatch(/[0-9]/);
    expect(day.getAttribute("aria-label")).toMatch(/২টি শুনানি/);
  });

  it("has no axe violations", async () => {
    const { container } = mount(<HearingCalendar />);
    await screen.findByTestId("cal-unscheduled");
    const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } }, resultTypes: ["violations"] });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("HearingPanel", () => {
  it("says when no date is set and posts a date in Bangladesh time", async () => {
    const { post } = mount(<HearingPanel id="m1" hearingAt={null} canSet />);
    expect(screen.getByTestId("hearing-when")).toHaveTextContent("Not scheduled yet");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-25" } });
    fireEvent.change(screen.getByLabelText(/Time/), { target: { value: "11:15" } });
    fireEvent.click(screen.getByTestId("hearing-save"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/mutations/m1/hearing", { hearing_at: "2026-10-25T11:15:00+06:00" }));
  });

  it("refuses a date before today and an empty one", () => {
    const { post } = mount(<HearingPanel id="m1" hearingAt={null} canSet />);
    fireEvent.click(screen.getByTestId("hearing-save"));
    expect(screen.getByText("Enter a date.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-16" } });
    fireEvent.click(screen.getByTestId("hearing-save"));
    expect(screen.getByText("The date cannot be in the past.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("only shows the date to people who cannot set it", () => {
    mount(<HearingPanel id="m1" hearingAt="2026-10-20T18:30:00Z" canSet={false} />);
    expect(screen.getByTestId("hearing-when").textContent).toMatch(/21/);
    expect(screen.queryByTestId("hearing-save")).toBeNull();
  });
});
