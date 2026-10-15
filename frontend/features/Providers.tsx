"use client";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "./auth/AuthContext";
import { applyTheme, readTheme } from "@/lib/theme";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  // Switching language loads a new <html> without the classes theme-init.js set on the first load: re-apply the saved theme.
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-switching"); // no colour fade while the page repaints in the saved theme
    applyTheme(readTheme());
    window.setTimeout(() => root.classList.remove("theme-switching"), 150);
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>
    </QueryClientProvider>
  );
}
