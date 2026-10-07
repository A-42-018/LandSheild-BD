"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createApiClient, type ApiClient, type ApiUser } from "@/lib/api";

/**
 * The refresh cookie is httpOnly (and on another origin in production), so the page cannot see it.
 * A signed-in browser leaves this flag; without it we skip the boot-time /auth/refresh call, which
 * would only return 401 (a red console error for every anonymous visitor).
 */
export const SESSION_HINT = "ls-session";
function hint(on?: boolean): boolean {
  try {
    if (on === true) window.localStorage.setItem(SESSION_HINT, "1");
    else if (on === false) window.localStorage.removeItem(SESSION_HINT);
    return window.localStorage.getItem(SESSION_HINT) === "1";
  } catch {
    return true; // storage blocked: fall back to asking the server
  }
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthValue {
  status: AuthStatus;
  user: ApiUser | null;
  api: ApiClient;
  login: (email: string, password: string) => Promise<ApiUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children, client }: { children: ReactNode; client?: ApiClient }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ApiUser | null>(null);

  const api = useMemo(
    () =>
      client ??
      createApiClient({
        onSession: (s) => {
          hint(!!s);
          setUser(s?.user ?? null);
          setStatus(s ? "authenticated" : "anonymous");
        },
      }),
    [client],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // restore session from the httpOnly refresh cookie (only if this browser ever signed in)
    if (!client && !hint()) {
      setStatus("anonymous");
      return;
    }
    api
      .refresh()
      .then((s) => {
        setUser(s?.user ?? null);
        setStatus(s ? "authenticated" : "anonymous");
      })
      .catch(() => setStatus("anonymous"));
  }, [api, client]);

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await api.login(email, password);
      setUser(s.user);
      setStatus("authenticated");
      return s.user;
    },
    [api],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, [api]);

  const value = useMemo(() => ({ status, user, api, login, logout }), [status, user, api, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
