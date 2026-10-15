import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";
import { EmptyState, ErrorState, LoadingState, Modal, StateCard, Table, Tabs } from "./index";

const wrap = (ui: React.ReactNode, locale: "en" | "bn" = "en") =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("Modal", () => {
  it("renders dialog with accessible name, closes on Esc, traps Tab", () => {
    const onClose = vi.fn();
    wrap(
      <Modal open onClose={onClose} title="Confirm" footer={<button>OK</button>}>
        <input aria-label="field" />
      </Modal>,
    );
    const dlg = screen.getByRole("dialog", { name: "Confirm" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    const closeBtn = screen.getByRole("button", { name: "Close" });
    const ok = screen.getByRole("button", { name: "OK" });
    expect(closeBtn).toHaveFocus();
    ok.focus();
    fireEvent.keyDown(ok, { key: "Tab" });
    expect(closeBtn).toHaveFocus();
    fireEvent.keyDown(closeBtn, { key: "Tab", shiftKey: true });
    expect(ok).toHaveFocus();
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("renders nothing when closed", () => {
    wrap(<Modal open={false} onClose={() => {}} title="x" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "a", label: "A", content: "Panel A" },
    { id: "b", label: "B", content: "Panel B" },
    { id: "c", label: "C", content: "Panel C" },
  ];
  it("arrow/Home/End keys move selection and focus", () => {
    wrap(<Tabs tabs={tabs} label="demo" />);
    const a = screen.getByRole("tab", { name: "A" });
    expect(a).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel B");
    fireEvent.keyDown(screen.getByRole("tab", { name: "B" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "C" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
  });
});

type Row = { id: string; name: string };
describe("Table", () => {
  const rows: Row[] = [{ id: "1", name: "Rahim" }, { id: "2", name: "Karim" }];
  const columns = [{ key: "name", header: "Name", sortable: true }];
  it("sort + pagination callbacks and aria-sort", () => {
    const onSort = vi.fn();
    const onPage = vi.fn();
    wrap(
      <Table columns={columns} rows={rows} rowKey={(r) => r.id} caption="Owners"
        sort={{ key: "name", dir: "asc" }} onSortChange={onSort}
        page={1} pageSize={2} total={5} onPageChange={onPage} />,
    );
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith({ key: "name", dir: "desc" });
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
  it("shows empty state when no rows", () => {
    wrap(<Table columns={columns} rows={[]} rowKey={(r: Row) => r.id} />);
    expect(screen.getByText("No records found.")).toBeInTheDocument();
  });
});

describe("states", () => {
  it("Empty/Loading/Error use i18n defaults in EN and BN", () => {
    const { unmount } = wrap(<><EmptyState /><LoadingState /><ErrorState onRetry={() => {}} /></>);
    expect(screen.getByText("No records found.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Processing…");
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't process this document.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    unmount();
    wrap(<ErrorState />, "bn");
    expect(screen.getByRole("alert")).toHaveTextContent(bn.errors.generic);
  });
});

describe("UI v2 Tabs/Modal", () => {
  it("segmented variant keeps tab semantics", () => {
    wrap(<Tabs variant="segmented" label="x" tabs={[{ id: "a", label: "A", content: "pa" }, { id: "b", label: "B", content: "pb" }]} />);
    expect(screen.getByRole("tablist").parentElement).toHaveAttribute("data-variant", "segmented");
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("aria-selected", "true");
  });
  it("Modal has a drag handle for the phone bottom sheet", () => {
    wrap(<Modal open onClose={() => {}} title="T">body</Modal>);
    expect(screen.getByRole("dialog")).toHaveClass("rounded-t-panel");
  });
});

describe("UI v2 system states", () => {
  it("StateCard shows heading, body and actions", () => {
    wrap(<StateCard title="Lost" body="Not here" actions={<button>Home</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Lost" })).toBeInTheDocument();
    expect(screen.getByText("Not here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
  });
  it("LoadingState renders skeleton bars behind the status label", () => {
    const { container } = wrap(<LoadingState />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(1);
  });
});

import { ToastProvider, useToast } from "./Toast";
describe("Toast + Reveal", () => {
  it("shows a success toast in a live region and can be closed", () => {
    const Btn = () => {
      const toast = useToast();
      return <button onClick={() => toast("success", "Saved!")}>go</button>;
    };
    wrap(<ToastProvider><Btn /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved!");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Saved!")).toBeNull();
  });
  it("useToast is a no-op without a provider", () => {
    const Btn = () => <button onClick={() => useToast()("error", "x")}>go</button>;
    expect(() => wrap(<Btn />)).not.toThrow();
  });
});
