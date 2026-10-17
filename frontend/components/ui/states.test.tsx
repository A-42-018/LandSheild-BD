import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";
import { ApiError } from "@/lib/api";
import { errorKind } from "@/lib/error-kind";
import { EmptyState, ErrorState, LoadingState } from "./index";
import { SLOW_AFTER_MS } from "./LoadingState";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const M = { en, bn } as const;
const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en") =>
  render(<NextIntlClientProvider locale={locale} messages={M[locale]}>{ui}</NextIntlClientProvider>);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("errorKind (U4.5)", () => {
  it("tells apart a missing connection, a timed-out sign-in, no permission, too many tries and a server fault", () => {
    expect(errorKind(new ApiError(0, "NETWORK_ERROR", "x"))).toBe("offline");
    expect(errorKind(new ApiError(401, "UNAUTHORIZED", "x"))).toBe("signedOut");
    expect(errorKind(new ApiError(403, "FORBIDDEN", "x"))).toBe("forbidden");
    expect(errorKind(new ApiError(429, "RATE_LIMITED", "x"))).toBe("tooMany");
    expect(errorKind(new ApiError(503, "HTTP_ERROR", "x"))).toBe("server");
    expect(errorKind(new ApiError(422, "INVALID", "x"))).toBe("other");
    expect(errorKind(undefined)).toBe("other");
    expect(errorKind(new Error("boom"))).toBe("other");
  });

  it("treats a browser that reports itself offline as offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(errorKind(new TypeError("Failed to fetch"))).toBe("offline");
  });
});

describe("ErrorState (U4.5)", () => {
  const cases: [string, unknown, "offline" | "signedOut" | "forbidden" | "tooMany" | "server", string[]][] = [
    ["no connection", new ApiError(0, "NETWORK_ERROR", "x"), "offline", ["offline", "offlineHint"]],
    ["timed-out sign-in", new ApiError(401, "UNAUTHORIZED", "x"), "signedOut", ["signedOut", "signedOutHint"]],
    ["no permission", new ApiError(403, "FORBIDDEN", "x"), "forbidden", ["permission"]],
    ["too many tries", new ApiError(429, "RATE_LIMITED", "x"), "tooMany", ["tooMany", "tooManyHint"]],
    ["server fault", new ApiError(500, "HTTP_ERROR", "x"), "server", ["server", "serverHint"]],
  ];

  for (const locale of ["en", "bn"] as const) {
    for (const [name, error, kind, keys] of cases) {
      it(`${locale}: ${name} says what happened and what to do`, () => {
        wrap(<ErrorState error={error} onRetry={() => {}} />, locale);
        const alert = screen.getByRole("alert");
        expect(alert).toHaveAttribute("data-kind", kind);
        for (const k of keys) expect(alert).toHaveTextContent((M[locale].errors as Record<string, string>)[k]);
      });
    }
  }

  it("hides Retry when trying again cannot help, and offers a sign-in link when signed out", () => {
    const retry = vi.fn();
    const { unmount } = wrap(<ErrorState error={new ApiError(403, "FORBIDDEN", "x")} onRetry={retry} />);
    expect(screen.queryByRole("button", { name: en.common.retry })).not.toBeInTheDocument();
    unmount();
    wrap(<ErrorState error={new ApiError(401, "UNAUTHORIZED", "x")} onRetry={retry} />);
    expect(screen.queryByRole("button", { name: en.common.retry })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.nav.login })).toHaveAttribute("href", "/login");
  });

  it("keeps Retry for a lost connection and calls it", () => {
    const retry = vi.fn();
    wrap(<ErrorState error={new ApiError(0, "NETWORK_ERROR", "x")} onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the screen's own message for an ordinary failure, and a plain default with a next step when there is none", () => {
    const { unmount } = wrap(<ErrorState error={new ApiError(422, "X", "x")} message="We could not load the map. Try again." />);
    expect(screen.getByRole("alert")).toHaveTextContent("We could not load the map. Try again.");
    unmount();
    wrap(<ErrorState />);
    expect(screen.getByRole("alert")).toHaveTextContent(en.errors.generic);
    expect(screen.getByRole("alert")).toHaveTextContent(en.errors.genericHint);
  });

  it("puts the server fault first and the screen's message after it", () => {
    wrap(<ErrorState error={new ApiError(500, "X", "x")} message="We could not load the map. Try again." />);
    expect(screen.getByRole("alert").textContent).toBe(`${en.errors.server}We could not load the map. Try again.`);
  });

  it("has no axe violations in either language", async () => {
    for (const l of ["en", "bn"] as const) {
      const { container, unmount } = wrap(<ErrorState error={new ApiError(401, "X", "x")} onRetry={() => {}} />, l);
      const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(r.violations).toEqual([]);
      unmount();
    }
  });
});

describe("LoadingState (U4.5)", () => {
  it("says what is happening, then blames a slow connection only after a while", () => {
    vi.useFakeTimers();
    wrap(<LoadingState />, "bn");
    expect(screen.getByRole("status")).toHaveTextContent(bn.common.loading);
    expect(screen.queryByTestId("loading-slow")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(SLOW_AFTER_MS + 10); });
    expect(screen.getByTestId("loading-slow")).toHaveTextContent(bn.common.slow);
  });
});

describe("EmptyState (U4.5)", () => {
  it("can carry a title, a next step in words and a button", () => {
    wrap(<EmptyState title={en.result.notFound} description={en.result.notFoundHint} action={<a href="/verify">Search</a>} />);
    expect(screen.getByText(en.result.notFound)).toBeInTheDocument();
    expect(screen.getByText(en.result.notFoundHint)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
  });
});
