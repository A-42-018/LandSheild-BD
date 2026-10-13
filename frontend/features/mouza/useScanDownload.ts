"use client";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api";

export type DownloadState = "idle" | "busy" | "failed" | "limited" | "missing";

/** Hand a blob to the browser as a file download without leaving the page. */
export function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Download one scanned mouza map. The backend fetches the PDF from the scan site and sends it back as a
 * same-origin file, so the user never leaves this page (the API needs the bearer token, hence blob()).
 */
export function useScanDownload() {
  const { api } = useAuth();
  const [state, setState] = useState<DownloadState>("idle");

  const run = async (url: string, filename: string) => {
    if (state === "busy") return;
    setState("busy");
    try {
      saveBlob(await api.blob(`/gis/scan?url=${encodeURIComponent(url)}`), filename);
      setState("idle");
    } catch (e) {
      setState(
        e instanceof ApiError && e.status === 429 ? "limited" : e instanceof ApiError && e.status === 404 ? "missing" : "failed",
      );
    }
  };
  return { state, run };
}
