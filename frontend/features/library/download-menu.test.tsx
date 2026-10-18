import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/components/ui";
import DownloadMenu, { downloadName, downloadPath } from "./DownloadMenu";

const user = { id: "1", name: "U", email: "u@x.co", role: "OFFICER", preferred_language: "en" };

function wrap(blob: any, props: Partial<React.ComponentProps<typeof DownloadMenu>> = {}, messages: any = en, locale = "en") {
  const client = { refresh: vi.fn().mockResolvedValue({ user }), get: vi.fn(), blob } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <ToastProvider>
            <DownloadMenu documentId="d1" fileType="pdf" version={2} draft={false} hasRecord {...props} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

let clicked: { href: string; download: string }[] = [];
beforeEach(() => {
  clicked = [];
  (URL as any).createObjectURL = vi.fn(() => "blob:x");
  (URL as any).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download });
  });
});
afterEach(() => vi.restoreAllMocks());

const open = async () => {
  await screen.findByTestId("download-trigger");
  fireEvent.click(screen.getByTestId("download-trigger"));
};

describe("download helpers", () => {
  it("builds the API path and the file names the server sends", () => {
    expect(downloadPath("pdf", "d1", 2)).toBe("/documents/d1/download?what=pdf&version=2");
    expect(downloadPath("json", "d1", null)).toBe("/documents/d1/download?what=json");
    expect(downloadPath("original", "d1", 2)).toBe("/documents/d1/download?what=original");
    expect(downloadName("pdf", "d1", "png", 2, false)).toBe("landshield-deed-d1-v2.pdf");
    expect(downloadName("json", "d1", "png", 3, true)).toBe("landshield-record-d1-v3-draft.json");
    expect(downloadName("bundle", "d1", "png", 2, false)).toBe("landshield-bundle-d1-v2.zip");
    expect(downloadName("original", "d1", "jpg", 2, true)).toBe("landshield-original-d1.jpg");
  });
});

describe("DownloadMenu", () => {
  it("is closed until opened, lists the four downloads, and closes on Escape", async () => {
    wrap(vi.fn());
    await open();
    for (const k of ["pdf", "json", "original", "bundle"]) expect(screen.getByTestId(`download-${k}`)).toBeEnabled();
    expect(screen.getByTestId("download-trigger")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("download-list")).toBeNull();
  });

  it.each([
    ["pdf", "/documents/d1/download?what=pdf&version=2", "landshield-deed-d1-v2.pdf"],
    ["json", "/documents/d1/download?what=json&version=2", "landshield-record-d1-v2.json"],
    ["original", "/documents/d1/download?what=original", "landshield-original-d1.pdf"],
    ["bundle", "/documents/d1/download?what=bundle&version=2", "landshield-bundle-d1-v2.zip"],
  ])("%s: fetches the blob and saves it under its file name", async (kind, path, name) => {
    const blob = vi.fn().mockResolvedValue(new Blob(["x"]));
    wrap(blob);
    await open();
    fireEvent.click(screen.getByTestId(`download-${kind}`));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(blob).toHaveBeenCalledWith(path);
    expect(clicked[0].download).toBe(name);
    expect(await screen.findByText(/downloaded\./)).toBeInTheDocument();
  });

  it("marks a not-approved version as a draft in the file name and the note", async () => {
    wrap(vi.fn().mockResolvedValue(new Blob(["x"])), { draft: true, version: 1 });
    await open();
    expect(screen.getByTestId("download-draft-note")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("download-pdf"));
    await waitFor(() => expect(clicked[0]?.download).toBe("landshield-deed-d1-v1-draft.pdf"));
  });

  it("without a digital record only the original can be downloaded", async () => {
    wrap(vi.fn(), { hasRecord: false, version: null, draft: true });
    await open();
    expect(screen.getByTestId("download-original")).toBeEnabled();
    for (const k of ["pdf", "json", "bundle"]) expect(screen.getByTestId(`download-${k}`)).toBeDisabled();
  });

  it("shows the rate-limit message and keeps the menu open", async () => {
    wrap(vi.fn().mockRejectedValue(new ApiError(429, "RATE_LIMITED", "Too many requests")));
    await open();
    fireEvent.click(screen.getByTestId("download-json"));
    expect(await screen.findByText(en.library.download.errors.rateLimited)).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
    expect(screen.getByTestId("download-list")).toBeInTheDocument();
    expect(screen.getByTestId("download-json")).toBeEnabled();
  });

  it("explains a missing PDF engine and a refused download", async () => {
    const blob = vi.fn()
      .mockRejectedValueOnce(new ApiError(503, "PDF_ENGINE_UNAVAILABLE", "x"))
      .mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "x"));
    wrap(blob);
    await open();
    fireEvent.click(screen.getByTestId("download-pdf"));
    expect(await screen.findByText(en.library.download.errors.pdfUnavailable)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("download-pdf"));
    expect(await screen.findByText(en.library.download.errors.notAllowed)).toBeInTheDocument();
  });

  it("disables every item while one download is running", async () => {
    let done: (b: Blob) => void = () => {};
    wrap(vi.fn(() => new Promise<Blob>((r) => (done = r))));
    await open();
    fireEvent.click(screen.getByTestId("download-bundle"));
    await waitFor(() => expect(screen.getByTestId("download-pdf")).toBeDisabled());
    expect(screen.getByTestId("download-bundle")).toHaveAttribute("aria-busy", "true");
    done(new Blob(["x"]));
    await waitFor(() => expect(clicked).toHaveLength(1));
  });

  it("renders in Bangla", async () => {
    wrap(vi.fn(), {}, bn, "bn");
    await open();
    expect(screen.getByTestId("download-pdf")).toHaveTextContent(bn.library.download.kinds.pdf);
  });
});
