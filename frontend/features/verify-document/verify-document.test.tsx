import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import VerifyDocumentView from "./VerifyDocumentView";

const wrap = (upload: ReturnType<typeof vi.fn>, messages: any = en, locale = "en") => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const client = { refresh: vi.fn().mockResolvedValue(null), upload } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>
          <VerifyDocumentView />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
};

const pick = () => {
  const f = new File(["x"], "deed.png", { type: "image/png" });
  fireEvent.change(screen.getByTestId("doc-file"), { target: { files: [f] } });
};

describe("VerifyDocumentView", () => {
  it("submit is disabled until a file is chosen", () => {
    wrap(vi.fn());
    expect(screen.getByRole("button", { name: en.verifyDoc.submit })).toBeDisabled();
    pick();
    expect(screen.getByRole("button", { name: en.verifyDoc.submit })).toBeEnabled();
  });

  it("AUTHENTIC result", async () => {
    const upload = vi.fn().mockResolvedValue({ state: "AUTHENTIC", match: "FILE", differing: [] });
    wrap(upload);
    pick();
    fireEvent.click(screen.getByRole("button", { name: en.verifyDoc.submit }));
    await waitFor(() => expect(screen.getByTestId("doc-verify-result")).toHaveAttribute("data-state", "AUTHENTIC"));
    expect(upload).toHaveBeenCalledWith("/public/verify-document", expect.any(FormData));
    expect(screen.getByTestId("doc-state")).toHaveTextContent(en.verifyDoc.state.AUTHENTIC);
  });

  it("ALTERED result lists the differing field names", async () => {
    wrap(vi.fn().mockResolvedValue({ state: "ALTERED", match: null, differing: ["land_area"] }));
    pick();
    fireEvent.click(screen.getByRole("button", { name: en.verifyDoc.submit }));
    await waitFor(() => expect(screen.getByTestId("doc-differing")).toHaveTextContent(en.verifyDoc.fields.land_area));
  });

  it("maps API errors to messages", async () => {
    wrap(vi.fn().mockRejectedValue(new ApiError(415, "UNSUPPORTED_FILE_TYPE", "x")));
    pick();
    fireEvent.click(screen.getByRole("button", { name: en.verifyDoc.submit }));
    await waitFor(() => expect(screen.getByTestId("doc-error")).toHaveTextContent(en.verifyDoc.errors.file));
  });

  it("renders in Bangla", async () => {
    wrap(vi.fn().mockResolvedValue({ state: "NOT_FOUND", match: null, differing: [] }), bn, "bn");
    pick();
    fireEvent.click(screen.getByRole("button", { name: bn.verifyDoc.submit }));
    await waitFor(() => expect(screen.getByTestId("doc-state")).toHaveTextContent(bn.verifyDoc.state.NOT_FOUND));
  });
});
