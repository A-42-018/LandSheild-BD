import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import DeedView from "./deed/DeedView";
import ReviewView from "./ReviewView";
import type { ExtractionOut, LhdrRecord } from "./types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// the sample deed's gold file with every value wrapped as a Field, like the API returns it
const gold = JSON.parse(
  readFileSync(resolve(__dirname, "../../../database/sample_data/historical/Historical_Land_Deed.gold.json"), "utf8"),
);
function wrap(v: any): any {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x !== null ? wrap(x) : { value: x, confidence: 0.93 }));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrap(x)]));
  return { value: v, confidence: 0.93 };
}
const record: LhdrRecord = wrap(gold);

const reviewer = { id: "1", name: "R", email: "r@x.co", role: "REVIEWER", preferred_language: "en" };
const doc = { id: "d1", land_id: "LP-10001", document_type: "DEED", processing_status: "REVIEW_REQUIRED",
  file_hash: "a".repeat(64), file_type: "png", created_at: "2026-10-01T00:00:00Z", party_nids: { buyer: "0077" } };

function base(over: Partial<ExtractionOut> = {}): ExtractionOut {
  return {
    document_id: "d1", processing_status: "REVIEW_REQUIRED", provider: "rules", threshold: 0.85,
    deed_profile: "historical", record,
    fields: [{ field: "deed_no", value: "4782/খ", confidence: 0.95, source_bbox: null, edited_by_human: false, low_confidence: false }],
    edited_by_human: false, has_low_confidence: false, low_confidence_fields: [],
    validation: { valid: true, errors: [] }, ...over,
  };
}

function setup(ext: Partial<ExtractionOut> = {}, patch?: (body: any) => Promise<ExtractionOut>) {
  const full = base(ext);
  const patchFn = vi.fn((_path: string, body: any) => (patch ? patch(body) : Promise.resolve(full)));
  const get = vi.fn((path: string) =>
    Promise.resolve(path.endsWith("/extraction") ? full : { ...doc, processing_status: full.processing_status }),
  );
  const client = { refresh: vi.fn().mockResolvedValue({ user: reviewer }), get, patch: patchFn, post: vi.fn(),
    blob: vi.fn().mockResolvedValue(new Blob(["x"])) } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={client}><ReviewView id="d1" /></AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { patch: patchFn };
}


const open = async (id: string) => fireEvent.click(await screen.findByTestId(`deed-${id}-edit`));
const type = (id: string, text: string) => fireEvent.change(screen.getByTestId(`deed-${id}-input`), { target: { value: text } });
const save = (id: string) => fireEvent.click(screen.getByTestId(`deed-${id}-save`));
const lastOps = (patch: any, n = 1) => patch.mock.calls[n - 1][1].record;
const withWitness = (): LhdrRecord => ({
  ...record,
  execution: { ...record.execution, witnesses: [{ role: { value: "WITNESS" }, name: { value: "আব্দুল হক" } }], seals: [{ value: "গোল সিল" }] },
});

describe("lists of the digital deed (H6c)", () => {
  it("is read-only without an editing context: no add or remove controls", () => {
    render(<NextIntlClientProvider locale="en" messages={en}><DeedView record={record} /></NextIntlClientProvider>);
    expect(screen.queryByTestId("deed-plot-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deed-plot0-remove")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deed-party-add")).not.toBeInTheDocument();
  });

  it("adds a plot (add /schedule/-) and removes one after confirming (remove /schedule/0)", async () => {
    const { patch } = setup();
    fireEvent.click(await screen.findByTestId("deed-plot-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/schedule/-", value: {} }]);

    fireEvent.click(screen.getByTestId("deed-plot0-remove"));
    expect(patch).toHaveBeenCalledTimes(1); // asks first
    fireEvent.click(screen.getByTestId("deed-plot0-remove-yes"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "remove", path: "/schedule/0" }]);
  });

  it("cancelling the confirmation sends nothing", async () => {
    const { patch } = setup();
    fireEvent.click(await screen.findByTestId("deed-plot0-remove"));
    fireEvent.click(within(screen.getByTestId("deed-plot0-remove-box")).getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("deed-plot0-remove")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("adds a party with its role and name, and removes a party", async () => {
    const { patch } = setup();
    fireEvent.change(await screen.findByTestId("deed-party-add-select"), { target: { value: "DONEE" } });
    fireEvent.change(screen.getByTestId("deed-party-add-input"), { target: { value: "  করিম  " } });
    fireEvent.click(screen.getByTestId("deed-party-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/parties/-", value: { role: "DONEE", name: "করিম" } }]);

    fireEvent.click(screen.getByTestId("deed-party1-remove"));
    fireEvent.click(screen.getByTestId("deed-party1-remove-yes"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "remove", path: "/parties/1" }]);
  });

  it("a party can be added without a name", async () => {
    const { patch } = setup();
    await screen.findByTestId("deed-party-add");
    fireEvent.click(screen.getByTestId("deed-party-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/parties/-", value: { role: "SELLER" } }]);
  });

  it("edits party values by pointer: role, mother, father deceased", async () => {
    const { patch } = setup();
    await open("party1_role");
    fireEvent.change(screen.getByTestId("deed-party1_role-input"), { target: { value: "DONEE" } });
    save("party1_role");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "replace", path: "/parties/1/role", value: "DONEE" }]);

    await open("party0_mother");
    type("party0_mother", "রহিমা খাতুন");
    save("party0_mother");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "replace", path: "/parties/0/mother", value: "রহিমা খাতুন" }]);

    await open("party0_father_deceased");
    fireEvent.change(screen.getByTestId("deed-party0_father_deceased-input"), { target: { value: "false" } });
    save("party0_father_deceased");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
    expect(lastOps(patch, 3)).toEqual([{ op: "replace", path: "/parties/0/father/deceased", value: false }]);
  });

  it("edits a plot value and a boundary side of the compass", async () => {
    const { patch } = setup();
    await open("plot0_mouza");
    type("plot0_mouza", "কাঞ্চন");
    save("plot0_mouza");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "replace", path: "/schedule/0/mouza", value: "কাঞ্চন" }]);

    const compass = screen.getByTestId("deed-boundaries-plot0");
    fireEvent.click(within(compass).getByTestId("deed-plot0_north-edit"));
    type("plot0_north", "পুকুর");
    save("plot0_north");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "replace", path: "/schedule/0/boundaries/north", value: "পুকুর" }]);

    fireEvent.click(within(compass).getByTestId("deed-plot0_south-edit"));
    type("plot0_south", "");
    save("plot0_south");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
    expect(lastOps(patch, 3)).toEqual([{ op: "replace", path: "/schedule/0/boundaries/south", value: null }]);
  });

  it("the compass has all four sides and an area number edit sends a number", async () => {
    const { patch } = setup();
    const compass = await screen.findByTestId("deed-boundaries-plot0");
    for (const s of ["north", "south", "east", "west"]) expect(within(compass).getByTestId(`deed-plot0_${s}-edit`)).toBeInTheDocument();
    await open("plot0_area");
    type("plot0_area", "1.25");
    save("plot0_area");
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "replace", path: "/schedule/0/area/value", value: 1.25 }]);
  });

  it("adds and removes a dag number", async () => {
    const { patch } = setup();
    fireEvent.change(await screen.findByTestId("deed-plot0_dag-add-input"), { target: { value: "456" } });
    fireEvent.click(screen.getByTestId("deed-plot0_dag-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/schedule/0/dag_no/-", value: "456" }]);

    fireEvent.click(screen.getByTestId("deed-plot0_dag0-remove"));
    fireEvent.click(screen.getByTestId("deed-plot0_dag0-remove-yes"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "remove", path: "/schedule/0/dag_no/0" }]);
  });

  it("adds a witness, then removes an existing one", async () => {
    const { patch } = setup({ record: withWitness() });
    expect(await screen.findByTestId("deed-party-witness0")).toHaveTextContent("আব্দুল হক");
    fireEvent.change(screen.getByTestId("deed-witness-add-input"), { target: { value: "ইউসুফ" } });
    fireEvent.click(screen.getByTestId("deed-witness-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/execution/witnesses/-", value: { role: "WITNESS", name: "ইউসুফ" } }]);

    fireEvent.click(screen.getByTestId("deed-witness0-remove"));
    fireEvent.click(screen.getByTestId("deed-witness0-remove-yes"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "remove", path: "/execution/witnesses/0" }]);
  });

  it("a witness needs a name: nothing is sent and the box says so", async () => {
    const { patch } = setup();
    fireEvent.click(await screen.findByTestId("deed-witness-add"));
    expect(await screen.findByText("Enter a value.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("adds a stamp with its type and removes it", async () => {
    const { patch } = setup();
    fireEvent.change(await screen.findByTestId("deed-stamp-add-select"), { target: { value: "NON_JUDICIAL" } });
    fireEvent.change(screen.getByTestId("deed-stamp-add-input"), { target: { value: "৫ টাকা" } });
    fireEvent.click(screen.getByTestId("deed-stamp-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/execution/stamps/-", value: { type: "NON_JUDICIAL", value: "৫ টাকা" } }]);

    fireEvent.click(screen.getByTestId("deed-stamp0-remove"));
    fireEvent.click(screen.getByTestId("deed-stamp0-remove-yes"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "remove", path: "/execution/stamps/0" }]);
  });

  it("adds and removes a seal", async () => {
    const { patch } = setup({ record: withWitness() });
    fireEvent.change(await screen.findByTestId("deed-seal-add-input"), { target: { value: "চতুর্ভুজ সিল" } });
    fireEvent.click(screen.getByTestId("deed-seal-add"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(lastOps(patch)).toEqual([{ op: "add", path: "/execution/seals/-", value: "চতুর্ভুজ সিল" }]);
    fireEvent.click(screen.getByTestId("deed-seal0-remove"));
    fireEvent.click(screen.getByTestId("deed-seal0-remove-yes"));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(lastOps(patch, 2)).toEqual([{ op: "remove", path: "/execution/seals/0" }]);
  });

  it("a refused add shows the reason in its box", async () => {
    const { patch } = setup({}, () =>
      Promise.reject(new ApiError(422, "RECORD_PATCH_FAILED", "x", [{ path: "/schedule/-", code: "LIST_TOO_LONG" }])),
    );
    fireEvent.click(await screen.findByTestId("deed-plot-add"));
    expect(await screen.findByTestId("deed-plot-add-error")).toHaveTextContent("This value is not valid.");
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("an add that fails without details says it was not saved", async () => {
    setup({}, () => Promise.reject(new ApiError(500, "INTERNAL", "boom")));
    fireEvent.click(await screen.findByTestId("deed-party-add"));
    expect(await screen.findByTestId("deed-party-add-error")).toHaveTextContent("The value could not be saved. Try again.");
  });

  it("issues on a whole list are shown at the list; issues on a value stay with the value", async () => {
    setup({
      record_validation: {
        valid: false,
        errors: [{ path: "/parties", code: "MISSING_TRANSFEROR", message: "A deed needs a seller or donor" }],
        warnings: [{ path: "/schedule/0/area/value", code: "AREA_NOT_POSITIVE", message: "z" }],
      },
    });
    const c = await screen.findByTestId("deed-container-issue");
    expect(c).toHaveAttribute("data-path", "/parties");
    expect(c).toHaveTextContent("A deed needs a seller or donor");
    expect(screen.getAllByTestId("deed-container-issue")).toHaveLength(1);
    expect(screen.getByTestId("deed-plot0_area-issue")).toHaveTextContent("The area must be greater than zero.");
  });

  it("no add or remove once the document is decided", async () => {
    setup({ processing_status: "APPROVED" });
    expect(await screen.findByTestId("deed-view")).toBeInTheDocument();
    expect(screen.queryByTestId("deed-plot-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deed-party0-remove")).not.toBeInTheDocument();
  });
});
