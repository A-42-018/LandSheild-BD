import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import { ApiError, type ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import GraphView from "./GraphView";
import { connectionsOf, layoutGraph, COL_GAP } from "./layout";
import type { LandGraphDto } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/verify/graph",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

beforeAll(() => {
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as any).ResizeObserver = RO;
  (globalThis as any).DOMMatrixReadOnly = class { m22 = 1; constructor() {} };
});

const user = { id: "1", name: "O", email: "o@x.co", role: "OFFICER", preferred_language: "en" };

const GRAPH: LandGraphDto = {
  land_id: "LP-10240",
  nodes: [
    { id: "land:LP-10240", type: "Land", label: "LP-10240", props: { area: 20, area_unit: "decimal", status: "ACTIVE" } },
    { id: "person:r", type: "Person", label: "Rahim Uddin", props: { father_name: "Abdul Uddin" } },
    { id: "person:k", type: "Person", label: "Karim Mia", props: {} },
    { id: "person:h", type: "Person", label: "Hasan Ali", props: {} },
    { id: "tx:1", type: "Transaction", label: "SALE", props: { transaction_date: "2019-06-20", area: 20, area_unit: "decimal", status: "FLAGGED", flagged: true } },
    { id: "tx:2", type: "Transaction", label: "SALE", props: { transaction_date: "2019-06-22", area: 20, area_unit: "decimal", status: "RECORDED", flagged: false } },
    { id: "deed:1", type: "Deed", label: "D-77", props: { transaction_date: "2019-06-20", area: 20, area_unit: "decimal", status: "ACTIVE" } },
  ],
  edges: [
    { source: "person:r", target: "tx:1", type: "SOLD", flagged: true },
    { source: "person:k", target: "tx:1", type: "BOUGHT", flagged: true },
    { source: "tx:1", target: "land:LP-10240", type: "TRANSFERRED", flagged: true },
    { source: "tx:1", target: "deed:1", type: "REFERS_TO", flagged: true },
    { source: "person:r", target: "tx:2", type: "SOLD", flagged: false },
    { source: "person:h", target: "tx:2", type: "BOUGHT", flagged: false },
    { source: "tx:2", target: "land:LP-10240", type: "TRANSFERRED", flagged: false },
    { source: "person:h", target: "land:LP-10240", type: "OWNS", flagged: false },
  ],
};

function client(get: (p: string) => Promise<any>): ApiClient {
  return { refresh: vi.fn().mockResolvedValue({ user }), get } as unknown as ApiClient;
}
function wrap(c: ApiClient, landId?: string, messages: any = en, locale = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={qc}>
        <AuthProvider client={c}>
          <GraphView landId={landId} />
        </AuthProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
const okGet = (g: LandGraphDto) => vi.fn((p: string) => (p === `/lands/${g.land_id}/graph` ? Promise.resolve(g) : Promise.reject(new ApiError(404, "LAND_NOT_FOUND", "x"))));

describe("layout", () => {
  it("places columns left→right: Person < Transaction < Deed < Land, rows ordered", () => {
    const pos = Object.fromEntries(layoutGraph(GRAPH).map((p) => [p.node.id, p]));
    expect(pos["person:r"].x).toBe(0);
    expect(pos["tx:1"].x).toBe(COL_GAP);
    expect(pos["deed:1"].x).toBe(COL_GAP * 2);
    expect(pos["land:LP-10240"].x).toBe(COL_GAP * 3);
    expect(pos["person:r"].y).toBeLessThan(pos["person:k"].y);
    expect(pos["tx:1"].y).toBeLessThan(pos["tx:2"].y);
  });
  it("resolves connections for a node", () => {
    const c = connectionsOf(GRAPH, "tx:1");
    expect(c).toHaveLength(4);
    expect(c.filter((x) => x.edge.flagged)).toHaveLength(4);
  });
});

describe("GraphView", () => {
  it("shows loading then the canvas, legend, demo banner, flagged node text", async () => {
    wrap(client(okGet(GRAPH)), "LP-10240");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByTestId("graph-canvas")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(en.common.demoLabel);
    const legend = screen.getByRole("region", { name: en.graph.legendTitle });
    expect(legend).toHaveTextContent(`⚑ ${en.graph.flaggedEdge}`);
    expect(screen.getByText(en.graph.flaggedNote)).toBeInTheDocument();
    expect(screen.getByText(en.graph.panHint)).toBeInTheDocument();
  });

  it("list fallback: nodes grouped, flagged text (not colour only), click → detail panel with connections", async () => {
    wrap(client(okGet(GRAPH)), "LP-10240");
    fireEvent.click(await screen.findByRole("button", { name: en.graph.viewList }));
    const txList = screen.getByRole("list", { name: "Transaction nodes" });
    const items = within(txList).getAllByRole("button");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(`⚑ ${en.graph.flagged}`);
    expect(items[1]).not.toHaveTextContent(en.graph.flagged);
    expect(screen.getByText(en.graph.detailEmpty)).toBeInTheDocument();

    fireEvent.click(items[0]);
    expect(items[0]).toHaveAttribute("aria-pressed", "true");
    const detail = screen.getByTestId("graph-detail");
    expect(within(detail).getByText("Sale")).toBeInTheDocument();
    expect(within(detail).getByText(/Sold: Rahim Uddin/)).toBeInTheDocument();
    expect(within(detail).getAllByText(new RegExp(`⚑ ${en.graph.flagged}`)).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Rahim Uddin" }));
    expect(within(screen.getByTestId("graph-detail")).getByText("Abdul Uddin")).toBeInTheDocument();
  });

  it("citizen payload without father_name shows no father row", async () => {
    const g = { ...GRAPH, nodes: GRAPH.nodes.map((n) => ({ ...n, props: n.type === "Person" ? {} : n.props })) };
    wrap(client(okGet(g)), "LP-10240");
    fireEvent.click(await screen.findByRole("button", { name: en.graph.viewList }));
    fireEvent.click(screen.getByRole("button", { name: "Rahim Uddin" }));
    expect(screen.queryByText(en.result.fatherName)).toBeNull();
  });

  it("empty graph (land only) shows the empty message", async () => {
    const empty: LandGraphDto = { land_id: "LP-10001", nodes: [GRAPH.nodes[0]], edges: [] };
    wrap(client(okGet(empty)), "LP-10001");
    expect(await screen.findByText(en.graph.emptyGraph)).toBeInTheDocument();
  });

  it("404 → empty state", async () => {
    wrap(client(vi.fn(() => Promise.reject(new ApiError(404, "LAND_NOT_FOUND", "x")))), "LP-9");
    expect(await screen.findByText(en.result.notFound)).toBeInTheDocument();
  });

  it("403 → permission message", async () => {
    wrap(client(vi.fn(() => Promise.reject(new ApiError(403, "FORBIDDEN", "x")))), "LP-8");
    expect(await screen.findByText(en.errors.permission)).toBeInTheDocument();
  });

  it("network error shows retry; missing id shows empty", async () => {
    const get = vi.fn().mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "x")).mockResolvedValue(GRAPH);
    wrap(client(get), "LP-10240");
    const retry = await screen.findByRole("button", { name: en.common.retry });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId("graph-canvas")).toBeInTheDocument());
  });

  it("missing land id → empty state", () => {
    wrap(client(vi.fn()), undefined);
    expect(screen.getByText(en.result.notFound)).toBeInTheDocument();
  });

  it("renders in Bangla with translated labels", async () => {
    wrap(client(okGet(GRAPH)), "LP-10240", bn, "bn");
    fireEvent.click(await screen.findByRole("button", { name: bn.graph.viewList }));
    expect(screen.getByRole("heading", { name: bn.graph.title })).toBeInTheDocument();
    expect(screen.getAllByText(`⚑ ${bn.graph.flagged}`).length).toBe(1);
    expect(screen.getByText("Rahim Uddin")).toBeInTheDocument();
  });
});
