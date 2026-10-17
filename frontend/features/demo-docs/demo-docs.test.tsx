import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import UploadForm from "@/features/upload/UploadForm";
import VerifyDocumentView from "@/features/verify-document/VerifyDocumentView";
import { UPLOAD_DEMO_DOCS, VERIFY_DEMO_DOCS } from "./catalog";

const officer = { id: "1", name: "O", email: "o@x.co", role: "OFFICER", preferred_language: "en" };

function wrap(ui: React.ReactNode, c: Partial<ApiClient>, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = { refresh: vi.fn().mockResolvedValue({ user: officer }), get: vi.fn(), post: vi.fn(), ...c } as unknown as ApiClient;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}>{ui}</AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function stubFetch(ok = true) {
  const fetch = vi.fn(async (url: string) =>
    ok ? new Response(new Blob([`png:${url}`], { type: "image/png" })) : new Response("", { status: 404 }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

async function pickSample(key: string, m: any = en) {
  fireEvent.click(screen.getByRole("button", { name: m.demoDocs.open }));
  expect(screen.getByRole("dialog", { name: m.demoDocs.title })).toHaveTextContent(m.demoDocs.note);
  fireEvent.click(screen.getByTestId(`demo-doc-${key}`));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

describe("demo document picker: upload", () => {
  it("is closed until the button is pressed", () => {
    wrap(<UploadForm />, { upload: vi.fn() });
    expect(screen.queryByTestId("demo-picker")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.demoDocs.open }));
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(UPLOAD_DEMO_DOCS.length);
  });

  it("attaches the picked sample like an own file and submits it through the normal upload", async () => {
    const fetch = stubFetch();
    const upload = vi.fn().mockResolvedValue({
      id: "d1", land_id: null, document_type: "PORCHA", processing_status: "UPLOADED",
      file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", duplicate: false,
    });
    wrap(<UploadForm />, { upload });
    await pickSample("porcha");
    expect(fetch).toHaveBeenCalledWith("/demo-docs/Porcha_BS.png");
    expect(screen.getByTestId("selected-file")).toHaveTextContent("Porcha_BS.png");
    expect(screen.getByLabelText(en.upload.type)).toHaveValue("PORCHA"); // survey records use their own parser
    expect(screen.getByLabelText(en.upload.landId)).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    await screen.findByTestId("upload-result");
    const form = upload.mock.calls[0][1] as FormData;
    expect((form.get("file") as File).name).toBe("Porcha_BS.png");
    expect(form.get("document_type")).toBe("PORCHA");
    expect(form.get("land_id")).toBeNull();
  });

  it("keeps the dialog open with an error when a sample cannot be fetched", async () => {
    stubFetch(false);
    wrap(<UploadForm />, { upload: vi.fn() }, bn, "bn");
    fireEvent.click(screen.getByRole("button", { name: bn.demoDocs.open }));
    fireEvent.click(screen.getByTestId("demo-doc-doc1"));
    expect(await screen.findByText(bn.demoDocs.loadError)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("selected-file")).toBeNull();
  });
});

describe("demo document picker: verify a copy", () => {
  it("shows neutral file names only and sends the picked file", async () => {
    stubFetch();
    const upload = vi.fn().mockResolvedValue({ state: "ALTERED", match: null, differing: ["land_area"] });
    wrap(<VerifyDocumentView />, { upload });
    fireEvent.click(screen.getByRole("button", { name: en.demoDocs.open }));
    const dialog = screen.getByRole("dialog");
    for (const d of VERIFY_DEMO_DOCS) expect(dialog).toHaveTextContent(d.name);
    for (const s of Object.values(en.verifyDoc.state)) expect(dialog).not.toHaveTextContent(s);
    fireEvent.click(screen.getByTestId("demo-doc-altered"));
    await waitFor(() => expect(screen.getByTestId("doc-file-chip")).toHaveTextContent("Deed_Copy_01.png"));
    fireEvent.click(screen.getByRole("button", { name: en.verifyDoc.submit }));
    await waitFor(() => expect(screen.getByTestId("doc-verify-result")).toHaveAttribute("data-state", "ALTERED"));
    expect(((upload.mock.calls[0][1] as FormData).get("file") as File).name).toBe("Deed_Copy_01.png");
  });
});

describe("demo document files", () => {
  const root = join(__dirname, "../..");
  it("public copies are byte-identical to database/sample_data (backend fixtures match by hash)", () => {
    const files = new Set([...UPLOAD_DEMO_DOCS, ...VERIFY_DEMO_DOCS].map((d) => d.file));
    for (const f of files) {
      const pub = readFileSync(join(root, "public/demo-docs", f));
      const src = readFileSync(join(root, "../database/sample_data", f));
      expect(pub.equals(src), f).toBe(true);
    }
  });
});
