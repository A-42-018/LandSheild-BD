import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "./AuthContext";
import IdleTimeout from "./IdleTimeout";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/officer",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const logout = vi.fn().mockResolvedValue(undefined);
function mount() {
  const client = { refresh: vi.fn().mockResolvedValue(null), logout } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider client={client}>
          <IdleTimeout idleMinutes={1} warnSeconds={20} />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
const tick = (s: number) => act(() => { vi.advanceTimersByTime(s * 1000); });

describe("IdleTimeout", () => {
  beforeEach(() => { vi.useFakeTimers(); logout.mockClear(); replace.mockClear(); });
  afterEach(() => vi.useRealTimers());

  it("is silent while active, warns with a countdown, and Stay resets the clock", () => {
    mount();
    tick(30);
    expect(screen.queryByRole("dialog")).toBeNull();
    tick(15); // 45 s idle of 60: inside the 20 s warning window
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("idle-countdown")).toHaveTextContent("0:15");
    fireEvent.pointerDown(document.body); // background activity does not dismiss the warning
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.auth.idle.stay }));
    tick(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    tick(30);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it("activity before the warning pushes the deadline back", () => {
    mount();
    tick(35);
    fireEvent.keyDown(window, { key: "a" });
    tick(35); // 70 s since start, only 35 s since activity
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it("signs out and goes to the login page when the countdown ends", async () => {
    mount();
    tick(61);
    await act(async () => { await Promise.resolve(); });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/officer-login?expired=1");
  });
});
