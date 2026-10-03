import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, type TokenResponse } from "./api";

const user = { id: "u1", name: "Officer", email: "officer@demo.landshield.test", role: "OFFICER" as const, preferred_language: "en" };
const tok = (t: string): TokenResponse => ({ access_token: t, token_type: "bearer", expires_in: 900, user });
const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("api client", () => {
  it("login stores token and sends bearer on next call", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(200, tok("A1")))
      .mockResolvedValueOnce(json(200, { ok: true }));
    const api = createApiClient({ baseUrl: "http://x/api/v1", fetchImpl: f as any });
    await api.login("officer@demo.landshield.test", "pw");
    await api.get("/auth/me");
    expect(f.mock.calls[1][1].headers.Authorization).toBe("Bearer A1");
    expect(f.mock.calls[0][1].credentials).toBe("include");
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("silently refreshes once on 401 and retries", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(401, { code: "TOKEN_EXPIRED", message: "x" }))
      .mockResolvedValueOnce(json(200, tok("A2")))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    const onSession = vi.fn();
    const api = createApiClient({ baseUrl: "http://x", fetchImpl: f as any, onSession });
    await expect(api.get("/lands/1")).resolves.toEqual({ ok: 1 });
    expect(f.mock.calls[1][0]).toBe("http://x/auth/refresh");
    expect(f.mock.calls[2][1].headers.Authorization).toBe("Bearer A2");
    expect(onSession).toHaveBeenCalledWith(expect.objectContaining({ access_token: "A2" }));
  });

  it("does not loop: 401 after failed refresh throws ApiError and clears session", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(401, { code: "TOKEN_INVALID", message: "x" }))
      .mockResolvedValueOnce(json(401, { code: "UNAUTHORIZED", message: "no cookie" }));
    const onSession = vi.fn();
    const api = createApiClient({ baseUrl: "http://x", fetchImpl: f as any, onSession });
    await expect(api.get("/lands/1")).rejects.toMatchObject({ status: 401 });
    expect(f).toHaveBeenCalledTimes(2);
    expect(onSession).toHaveBeenLastCalledWith(null);
  });

  it("concurrent 401s share a single refresh", async () => {
    let refreshCalls = 0;
    const f = vi.fn(async (url: string, init: any) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls++;
        return json(200, tok("A3"));
      }
      return init.headers.Authorization === "Bearer A3" ? json(200, {}) : json(401, { code: "TOKEN_EXPIRED", message: "" });
    });
    const api = createApiClient({ baseUrl: "http://x", fetchImpl: f as any });
    await Promise.all([api.get("/a"), api.get("/b")]);
    expect(refreshCalls).toBe(1);
  });

  it("login errors are not refreshed and keep the backend code", async () => {
    const f = vi.fn().mockResolvedValue(json(401, { code: "INVALID_CREDENTIALS", message: "bad" }));
    const api = createApiClient({ baseUrl: "http://x", fetchImpl: f as any });
    await expect(api.login("a@b.co", "x")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("maps fetch failures to NETWORK_ERROR and 204 to undefined", async () => {
    const down = createApiClient({ baseUrl: "http://x", fetchImpl: vi.fn().mockRejectedValue(new TypeError("fail")) as any });
    await expect(down.get("/x")).rejects.toBeInstanceOf(ApiError);
    await expect(down.get("/x")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
    const ok = createApiClient({ baseUrl: "http://x", fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 204 })) as any });
    await expect(ok.logout()).resolves.toBeUndefined();
  });
});
