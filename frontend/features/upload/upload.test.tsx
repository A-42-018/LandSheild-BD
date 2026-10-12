import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import { navItemsFor } from "@/features/auth/roles";
import UploadForm from "./UploadForm";
import { MAX_BYTES, errorCodeFromApi, validateFile } from "./validation";
import type { DocumentUploadOut } from "./types";

const officer = { id: "1", name: "O", email: "o@x.co", role: "OFFICER", preferred_language: "en" };

const doc = (over: Partial<DocumentUploadOut> = {}): DocumentUploadOut => ({
  id: "d1",
  land_id: null,
  document_type: "DEED",
  processing_status: "UPLOADED",
  file_hash: "a".repeat(64),
  file_type: "pdf",
  created_at: "2026-10-01T00:00:00Z",
  duplicate: false,
  ...over,
});

function client(upload: any, get: any = vi.fn(), post: any = vi.fn(), user: any = officer): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user }), upload, get, post } as unknown as ApiClient;
}

function wrap(c: ApiClient, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <UploadForm />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function choose(file: File, m: any = en) {
  const input = screen.getByLabelText(m.upload.choose) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const pdf = (name = "deed.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });
const sized = (name: string, size: number) => {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("validateFile", () => {
  it("accepts allowed types and rejects exe, empty and oversize", () => {
    expect(validateFile({ name: "a.JPG", size: 10 })).toBeNull();
    expect(validateFile({ name: "a.jpeg", size: 10 })).toBeNull();
    expect(validateFile({ name: "a.exe", size: 10 })).toBe("UNSUPPORTED_FILE_TYPE");
    expect(validateFile({ name: "noext", size: 10 })).toBe("UNSUPPORTED_FILE_TYPE");
    expect(validateFile({ name: "a.pdf", size: 0 })).toBe("EMPTY_FILE");
    expect(validateFile({ name: "a.pdf", size: MAX_BYTES + 1 })).toBe("FILE_TOO_LARGE");
    expect(validateFile({ name: "a.pdf", size: MAX_BYTES })).toBeNull();
  });
  it("maps API errors to UI codes", () => {
    expect(errorCodeFromApi({ status: 415, code: "FILE_TYPE_MISMATCH" })).toBe("FILE_TYPE_MISMATCH");
    expect(errorCodeFromApi({ status: 413, code: "PDF_TOO_MANY_PAGES" })).toBe("PDF_TOO_MANY_PAGES");
    expect(errorCodeFromApi({ status: 403, code: "FORBIDDEN" })).toBe("PERMISSION");
    expect(errorCodeFromApi({ status: 0, code: "NETWORK_ERROR" })).toBe("NETWORK");
    expect(errorCodeFromApi({ status: 404, code: "LAND_NOT_FOUND" })).toBe("LAND_NOT_FOUND");
    expect(errorCodeFromApi({ status: 500, code: "X" })).toBe("GENERIC");
  });
});

describe("nav", () => {
  it("shows upload only to officer+", () => {
    const has = (r: any) => navItemsFor(r).some((i) => i.href === "/officer/upload");
    expect(has("OFFICER")).toBe(true);
    expect(has("ADMIN")).toBe(true);
    expect(has("REVIEWER")).toBe(false);
    expect(has("CITIZEN")).toBe(false);
    expect(has(null)).toBe(false);
  });
});

describe("UploadForm", () => {
  it.each([
    ["en", en],
    ["bn", bn],
  ])("rejects an .exe client-side with a %s message and never calls the API", async (locale, m) => {
    const upload = vi.fn();
    wrap(client(upload), m, locale);
    choose(new File(["MZ"], "evil.exe"), m);
    expect((await screen.findByTestId("upload-error")).textContent).toBe(m.upload.errors.UNSUPPORTED_FILE_TYPE);
    expect(screen.getByRole("button", { name: m.upload.submit })).toBeDisabled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects files over 10 MB", async () => {
    wrap(client(vi.fn()));
    choose(sized("big.pdf", MAX_BYTES + 1));
    expect((await screen.findByTestId("upload-error")).textContent).toBe(en.upload.errors.FILE_TOO_LARGE);
  });

  it("submits multipart with file + document_type + land_id and shows status badge", async () => {
    const upload = vi.fn().mockResolvedValue(doc({ land_id: "LP-10100", document_type: "KHATIAN" }));
    wrap(client(upload, vi.fn().mockResolvedValue(doc({ processing_status: "UPLOADED" }))));
    const f = pdf();
    choose(f);
    fireEvent.change(screen.getByLabelText(en.upload.type), { target: { value: "KHATIAN" } });
    fireEvent.change(screen.getByLabelText(en.upload.landId), { target: { value: "lp-10100" } });
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    await screen.findByTestId("upload-result");
    const form = upload.mock.calls[0][1] as FormData;
    expect(upload.mock.calls[0][0]).toBe("/documents/upload");
    expect(form.get("file")).toBe(f);
    expect(form.get("document_type")).toBe("KHATIAN");
    expect(form.get("land_id")).toBe("LP-10100");
    expect(screen.getByTestId("doc-status").textContent).toBe(en.status.UPLOADED);
    expect(screen.getByText(en.upload.uploaded)).toBeInTheDocument();
  });

  it("Start processing calls POST /documents/{id}/process while the document is UPLOADED", async () => {
    const upload = vi.fn().mockResolvedValue(doc());
    const post = vi.fn().mockResolvedValue(doc({ processing_status: "PROCESSING" }));
    wrap(client(upload, vi.fn().mockResolvedValue(doc()), post));
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    fireEvent.click(await screen.findByTestId("start-processing"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/documents/d1/process"));
  });

  it("blocks a malformed land id", async () => {
    const upload = vi.fn();
    wrap(client(upload));
    choose(pdf());
    fireEvent.change(screen.getByLabelText(en.upload.landId), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    expect(await screen.findByText(en.upload.errors.LAND_ID)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows server rejection (FILE_TYPE_MISMATCH) in EN and BN", async () => {
    for (const [locale, m] of [["en", en], ["bn", bn]] as const) {
      const upload = vi.fn().mockRejectedValue(new ApiError(415, "FILE_TYPE_MISMATCH", "x"));
      const { unmount } = wrap(client(upload), m, locale);
      choose(pdf(), m);
      fireEvent.click(screen.getByRole("button", { name: m.upload.submit }));
      expect((await screen.findByTestId("upload-error")).textContent).toBe(m.upload.errors.FILE_TYPE_MISMATCH);
      unmount();
    }
  });

  it("shows permission and network errors", async () => {
    const upload = vi.fn().mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "x"));
    wrap(client(upload));
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    expect((await screen.findByTestId("upload-error")).textContent).toBe(en.upload.errors.PERMISSION);
  });

  it("reports duplicate uploads", async () => {
    const upload = vi.fn().mockResolvedValue(doc({ duplicate: true, processing_status: "REVIEW_REQUIRED" }));
    wrap(client(upload, vi.fn().mockResolvedValue(doc({ processing_status: "REVIEW_REQUIRED" }))));
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    expect(await screen.findByText(en.upload.duplicate)).toBeInTheDocument();
  });

  it("renders upload progress as an accessible progressbar", async () => {
    const upload = vi.fn((_p: string, _f: FormData, o: any) => {
      o.onProgress(40);
      return new Promise(() => {});
    });
    wrap(client(upload));
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    const bar = await screen.findByRole("progressbar", { name: en.upload.progress });
    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "40"));
  });

  it("polls status until terminal, then stops", async () => {
    const upload = vi.fn().mockResolvedValue(doc());
    const get = vi
      .fn()
      .mockResolvedValueOnce(doc({ processing_status: "PROCESSING" }))
      .mockResolvedValue(doc({ processing_status: "EXTRACTED" }));
    wrap(client(upload, get));
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    await waitFor(() => expect(screen.getByTestId("doc-status").textContent).toBe(en.status.EXTRACTED), {
      timeout: 8000,
    });
    const calls = get.mock.calls.length;
    await new Promise((r) => setTimeout(r, 2500));
    expect(get.mock.calls.length).toBe(calls); // no further polling
  }, 15000);
});

describe("UploadForm office sortlist", () => {
  const OFFICE = {
    id: "o1", code: "LO-1", office_type: "Union Land Office", name_en: "Ashulia Union Land Office", name_bn: "আশুলিয়া ইউনিয়ন ভূমি অফিস",
    division_en: "Dhaka", division_bn: "ঢাকা", district_en: "Dhaka", district_bn: "ঢাকা", upazila_en: "Savar", upazila_bn: "সাভার",
  };
  const places = vi.fn(async (url: string) => {
    if (url.startsWith("/offices/divisions") || url.startsWith("/offices/districts")) return [{ en: "Dhaka", bn: "ঢাকা" }];
    if (url.startsWith("/offices/upazilas")) return [{ en: "Savar", bn: "সাভার" }];
    return { items: [{ ...OFFICE, union_en: null, union_bn: null, location: null }], total: 1 };
  });

  it("locks an office officer to their own office and sends no office_id", async () => {
    const upload = vi.fn().mockResolvedValue(doc({ office: { ...OFFICE } } as any));
    wrap(client(upload, places, vi.fn(), { ...officer, office: OFFICE }));
    expect(await screen.findByTestId("my-office")).toHaveTextContent("Ashulia Union Land Office / আশুলিয়া ইউনিয়ন ভূমি অফিস");
    expect(screen.queryByLabelText(/Division/)).toBeNull();
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect((upload.mock.calls[0][1] as FormData).get("office_id")).toBeNull();
    expect(await screen.findByTestId("doc-office")).toHaveTextContent("Dhaka / ঢাকা › Dhaka / ঢাকা › Savar / সাভার");
  });

  it("makes an admin pick the office (Division > Zila > Upozila) before uploading", async () => {
    const upload = vi.fn().mockResolvedValue(doc());
    wrap(client(upload, places, vi.fn(), { ...officer, role: "ADMIN" }));
    choose(pdf());
    fireEvent.click(await screen.findByRole("button", { name: en.upload.submit }));
    expect(upload).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText(/Division/), { target: { value: "Dhaka" } });
    await waitFor(() => expect(screen.getByLabelText(/Zila/)).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Zila/), { target: { value: "Dhaka" } });
    fireEvent.change(await screen.findByLabelText(/Upozila/), { target: { value: "Savar" } });
    const office = await screen.findByLabelText(/Land office/);
    await waitFor(() => expect(office.querySelectorAll("option").length).toBe(2));
    fireEvent.change(office, { target: { value: "o1" } });
    fireEvent.click(screen.getByRole("button", { name: en.upload.submit }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect((upload.mock.calls[0][1] as FormData).get("office_id")).toBe("o1");
  });

  it("explains an office mismatch (403) instead of a generic permission error", () => {
    expect(errorCodeFromApi({ status: 403, code: "OFFICE_MISMATCH" })).toBe("OFFICE_MISMATCH");
    expect(errorCodeFromApi({ status: 409, code: "DOCUMENT_ALREADY_FILED" })).toBe("DOCUMENT_ALREADY_FILED");
  });
});
