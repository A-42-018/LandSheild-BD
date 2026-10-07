import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, SESSION_HINT, useAuth } from "./AuthContext";

function Probe() {
  const { status } = useAuth();
  return <p data-testid="status">{status}</p>;
}

const user = { id: "1", name: "O", email: "o@x.co", role: "OFFICER", preferred_language: "en" };

describe("boot-time session restore", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "t", expires_in: 900, user }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("an anonymous visitor makes no /auth/refresh request (no 401 in the console)", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a browser that signed in before restores the session and keeps the hint", async () => {
    window.localStorage.setItem(SESSION_HINT, "1");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/refresh$/);
    expect(window.localStorage.getItem(SESSION_HINT)).toBe("1");
  });

  it("a stale hint (cookie gone) is cleared after one failed refresh", async () => {
    window.localStorage.setItem(SESSION_HINT, "1");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "x" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(window.localStorage.getItem(SESSION_HINT)).toBeNull();
  });
});
