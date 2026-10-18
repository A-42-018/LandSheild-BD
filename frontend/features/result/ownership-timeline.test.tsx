import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import OwnershipTimeline from "./OwnershipTimeline";
import LandDocuments from "../library/LandDocuments";
import type { OwnershipEntry } from "./types";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/verify/result",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const mockDocs = vi.hoisted(() => ({ data: null as any }));
vi.mock("../library/useDocumentPage", () => ({
  useLandDocuments: () => ({ isLoading: false, isError: false, data: mockDocs.data, refetch: vi.fn() }),
}));

const p = (name: string) => ({ name, father_name: null });
const ENTRIES: OwnershipEntry[] = [
  { owner: p("রামকান্ত দাশ"), start_date: "1944-02-27", end_date: "1944-02-27", is_current: false, kind: "HISTORICAL", historical: true, confidence: 0.9, document: { id: "d1", type: "DEED" } },
  { owner: p("Hasan Ali"), start_date: "2008-01-10", end_date: null, is_current: true, kind: "CURRENT", historical: false, confidence: null, document: null },
];

function wrap(ui: React.ReactElement, locale: "en" | "bn" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("OwnershipTimeline historical link (H9b)", () => {
  it("marks the 1944 link as historical, not current, with its date and no end range", () => {
    wrap(<OwnershipTimeline entries={ENTRIES} staff />);
    const items = within(screen.getByRole("list", { name: en.result.ownership })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByTestId("historical-link")).toHaveTextContent(en.result.historicalLink);
    expect(within(items[0]).queryByText(en.result.current)).toBeNull();
    expect(items[0]).toHaveTextContent("1944");
    expect(items[0]).not.toHaveTextContent(en.result.present);
    expect(within(items[1]).queryByTestId("historical-link")).toBeNull();
    expect(within(items[1]).getByText(en.result.current)).toBeInTheDocument();
  });

  it("staff open the source document page from the link", () => {
    wrap(<OwnershipTimeline entries={ENTRIES} staff />);
    expect(screen.getByRole("link", { name: /DEED/ })).toHaveAttribute("href", "/officer/documents/d1");
  });

  it("citizens see the source document as plain text", () => {
    wrap(<OwnershipTimeline entries={ENTRIES} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("DEED")).toBeInTheDocument();
  });

  it("shows a real range when the link ends at the next holder", () => {
    wrap(<OwnershipTimeline entries={[{ ...ENTRIES[0], end_date: "1962-05-01" }]} staff />);
    expect(screen.getByRole("listitem")).toHaveTextContent("1962");
    expect(screen.getByRole("listitem")).not.toHaveTextContent("end not known");
  });

  it("is translated in Bangla", () => {
    wrap(<OwnershipTimeline entries={ENTRIES} staff />, "bn");
    expect(screen.getByTestId("historical-link")).toHaveTextContent(bn.result.historicalLink);
  });
});

describe("LandDocuments chain-of-title mark (H9b)", () => {
  const item = (id: string, link: any) => ({
    id, land_id: "LP-1", document_type: "DEED", processing_status: "APPROVED", file_type: "pdf", created_at: "2026-10-01T08:00:00Z",
    office: null, deed_no: id, mouza: null, deed_date: "1944-02-27", deed_profile: "historical", historical: true,
    uploaded_by_me: false, digitised: true, approved_version: 1, versions: 1, needs_my_action: false,
    approved_record: null, chain_link: link,
  });

  it("marks only the document that is a link of the chain", () => {
    mockDocs.data = { land_id: "LP-1", total: 2, items: [item("d1", { start_date: "1944-02-27", end_date: "1944-02-27" }), item("d2", null)] };
    wrap(<LandDocuments landId="LP-1" />);
    expect(screen.getByTestId("chain-link-d1")).toHaveTextContent(en.library.landDocs.chainLink);
    expect(screen.queryByTestId("chain-link-d2")).toBeNull();
  });
});
