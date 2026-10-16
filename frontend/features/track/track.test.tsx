import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import TrackView from "./TrackView";
import { SENTENCE_STATUSES, statusSentence } from "./sentence";
import { MUTATION_NO, normaliseNo, type MutationStatusDto } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/track",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const HEARING: MutationStatusDto = {
  mutation_no: "MUT-2026-0009", status: "HEARING", fast_track: false, office: "AC Land Office, Sreepur",
  applied_at: "2026-10-01T09:00:00+00:00", days_pending: 5,
  steps: [
    { step: "APPLIED", state: "done", at: "2026-10-01T09:00:00+00:00" },
    { step: "REVIEW", state: "done", at: "2026-10-01T09:00:01+00:00" },
    { step: "HEARING", state: "current", at: "2026-10-01T09:00:02+00:00" },
    { step: "DECIDED", state: "pending", at: null },
  ],
};
const REJECTED: MutationStatusDto = {
  ...HEARING, mutation_no: "MUT-2026-0010", status: "REJECTED", days_pending: null,
  steps: [
    { step: "APPLIED", state: "done", at: "2026-10-01T09:00:00+00:00" },
    { step: "REVIEW", state: "done", at: null },
    { step: "HEARING", state: "skipped", at: null },
    { step: "DECIDED", state: "done", at: "2026-10-03T09:00:00+00:00" },
  ],
};

function wrap(request: ApiClient["request"], messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = { refresh: vi.fn().mockResolvedValue(null), request } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <TrackView />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
const submit = (v: string) => {
  fireEvent.change(screen.getByLabelText(/Mutation number/), { target: { value: v } });
  fireEvent.click(screen.getByRole("button", { name: "Track status" }));
};

describe("mutation number", () => {
  it("accepts MUT-YYYY-NNNN only, case and space tolerant", () => {
    expect(MUTATION_NO.test(normaliseNo("  mut-2026-0009 "))).toBe(true);
    for (const bad of ["MUT-26-9", "LP-10240", "MUT-2026-00091", ""]) expect(MUTATION_NO.test(normaliseNo(bad))).toBe(false);
  });
});

describe("TrackView", () => {
  it("rejects a malformed number without calling the API", () => {
    const request = vi.fn();
    wrap(request as any);
    submit("hello");
    expect(screen.getByText("Enter the number like MUT-2026-0001.")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it("looks up ?no= from the home-page search card on arrival (U1.3)", async () => {
    window.history.pushState({}, "", "/track?no=MUT-2026-0009");
    const request = vi.fn().mockResolvedValue(HEARING);
    try {
      wrap(request as any);
      expect(await screen.findByTestId("track-result")).toBeInTheDocument();
      expect(screen.getByLabelText(/Mutation number/)).toHaveValue("MUT-2026-0009");
      expect(request).toHaveBeenCalledWith("/public/mutation-status/MUT-2026-0009", { anonymous: true });
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("calls the public endpoint anonymously and shows the stepper (hearing)", async () => {
    const request = vi.fn().mockResolvedValue(HEARING);
    wrap(request as any);
    submit(" mut-2026-0009 ");
    await screen.findByTestId("track-result");
    expect(request).toHaveBeenCalledWith("/public/mutation-status/MUT-2026-0009", { anonymous: true });
    expect(screen.getByTestId("track-status")).toHaveTextContent("Hearing");
    expect(screen.getByTestId("track-days")).toHaveTextContent("5 days");
    const steps = screen.getByTestId("track-steps");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByTestId("step-HEARING")).toHaveAttribute("data-state", "current");
    expect(screen.getByTestId("step-HEARING")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("step-DECIDED")).toHaveAttribute("data-state", "pending");
    expect(screen.getByTestId("step-DECIDED")).toHaveTextContent("Not reached yet");
  });

  it("shows the outcome for a decided application and a skipped hearing", async () => {
    wrap(vi.fn().mockResolvedValue(REJECTED) as any);
    submit("MUT-2026-0010");
    await screen.findByTestId("track-result");
    expect(screen.getByTestId("step-HEARING")).toHaveTextContent("Not needed");
    expect(screen.getByTestId("step-DECIDED")).toHaveTextContent("Rejected");
    expect(screen.getByTestId("track-days")).toHaveTextContent("Decided");
  });

  it("maps 404 and 429 to friendly messages", async () => {
    const request = vi.fn().mockRejectedValueOnce(new ApiError(404, "MUTATION_NOT_FOUND", "x")).mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "x"));
    wrap(request as any);
    submit("MUT-2026-0001");
    expect(await screen.findByText("No application found with this number.")).toBeInTheDocument();
    submit("MUT-2026-0002");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Too many requests"));
  });

  it("renders in Bangla", async () => {
    wrap(vi.fn().mockResolvedValue(HEARING) as any, bn, "bn");
    fireEvent.change(screen.getByLabelText(new RegExp(bn.track.number)), { target: { value: "MUT-2026-0009" } });
    fireEvent.click(screen.getByRole("button", { name: bn.track.submit }));
    await screen.findByTestId("track-result");
    expect(screen.getByTestId("step-HEARING")).toHaveTextContent(bn.track.steps.HEARING);
    expect(screen.getByTestId("step-HEARING")).toHaveTextContent(bn.track.state.current);
  });

  it("leads with a plain status sentence: number, stage, days, office (U2.5)", async () => {
    wrap(vi.fn().mockResolvedValue(HEARING) as any);
    submit("MUT-2026-0009");
    const line = await screen.findByTestId("track-sentence");
    expect(line).toHaveTextContent("MUT-2026-0009: Your application is at the hearing step.");
    expect(line).toHaveTextContent("You applied 5 days ago. Office: AC Land Office, Sreepur.");
  });

  it("drops the days for a decided application and says the outcome (U2.5)", async () => {
    wrap(vi.fn().mockResolvedValue(REJECTED) as any);
    submit("MUT-2026-0010");
    const line = await screen.findByTestId("track-sentence");
    expect(line).toHaveTextContent("Your application was rejected. Ask the office for the reason.");
    expect(line).not.toHaveTextContent("You applied");
  });

  it("writes the sentence in Bangla with Bangla digits (U2.5)", async () => {
    wrap(vi.fn().mockResolvedValue(HEARING) as any, bn, "bn");
    fireEvent.change(screen.getByLabelText(new RegExp(bn.track.number)), { target: { value: "MUT-2026-0009" } });
    fireEvent.click(screen.getByRole("button", { name: bn.track.submit }));
    const line = await screen.findByTestId("track-sentence");
    expect(line).toHaveTextContent("আপনার আবেদন এখন শুনানির ধাপে আছে।");
    expect(line).toHaveTextContent("আপনি ৫ দিন আগে আবেদন করেছেন।");
  });
});

describe("statusSentence", () => {
  const base = { days_pending: null, office: null };
  it("has a sentence for every known status in both languages", () => {
    for (const status of SENTENCE_STATUSES) {
      expect(statusSentence({ ...base, status }).status).toBe(status);
      expect((en.track.sentence as Record<string, string>)[status]).toBeTruthy();
      expect((bn.track.sentence as Record<string, string>)[status]).toBeTruthy();
    }
  });
  it("falls back for a status it does not know", () => {
    expect(statusSentence({ ...base, status: "WITHDRAWN" }).status).toBe("UNKNOWN");
  });
  it("passes days and office through", () => {
    expect(statusSentence({ status: "APPLIED", days_pending: 0, office: "X" })).toEqual({ status: "APPLIED", days: 0, office: "X" });
  });
});
