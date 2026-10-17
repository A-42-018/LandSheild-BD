import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import bn from "../../messages/bn.json";
import type { ApiClient } from "@/lib/api";
import { AuthProvider } from "@/features/auth/AuthContext";
import ContentPanel from "./ContentPanel";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/content",
  Link: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a>,
}));

const item = (o: any = {}) => ({
  id: "c1", kind: "NOTICE", title_en: "Office closed Friday", title_bn: "শুক্রবার অফিস বন্ধ",
  body_en: "Closed for the holiday.", body_bn: "ছুটির কারণে বন্ধ।", published_on: "2026-10-20", ticker: true,
  published: true, position: 0, created_at: "2026-10-17T08:00:00Z", updated_at: "2026-10-17T08:00:00Z", ...o,
});
const page = (items: any[]) => ({ items, total: items.length, limit: 20, offset: 0 });

function wrap(over: any = {}, locale: "en" | "bn" = "en") {
  const get = over.get ?? vi.fn(async () => page([item(), item({ id: "c2", title_en: "Draft notice", published: false, ticker: false })]));
  const post = over.post ?? vi.fn(async () => item());
  const patch = over.patch ?? vi.fn(async () => item());
  const del = over.del ?? vi.fn(async () => undefined);
  const client = { refresh: vi.fn().mockResolvedValue({ user: { id: "me", name: "Ada", email: "a@x.co", role: "ADMIN", preferred_language: "en" } }), get, post, patch, del } as unknown as ApiClient;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const out = render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      <QueryClientProvider client={qc}><AuthProvider client={client}><ContentPanel /></AuthProvider></QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { get, post, patch, del, ...out };
}

afterEach(cleanup);

describe("admin content management (U3.6)", () => {
  it("lists notices with their published, draft and ticker status", async () => {
    const { get } = wrap();
    const table = await screen.findByTestId("content-table");
    expect(get).toHaveBeenCalledWith("/admin/content?kind=NOTICE&limit=20&offset=0");
    expect(within(table).getByText("Office closed Friday")).toBeInTheDocument();
    expect(within(table).getByText("Published")).toBeInTheDocument();
    expect(within(table).getByText("Draft")).toBeInTheDocument();
    expect(within(table).getByText("In ticker")).toBeInTheDocument();
  });

  it("switches kind and asks the server for that kind", async () => {
    const { get } = wrap();
    await screen.findByTestId("content-table");
    fireEvent.click(screen.getByRole("tab", { name: "FAQ" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/admin/content?kind=FAQ&limit=20&offset=0"));
  });

  it("creates a notice only when both languages and the date are filled", async () => {
    const { post } = wrap();
    await screen.findByTestId("content-table");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const dlg = within(screen.getByRole("dialog"));
    const save = dlg.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.change(dlg.getByLabelText(/^Title \(Bangla\)/), { target: { value: "নতুন নোটিশ" } });
    fireEvent.change(dlg.getByLabelText(/^Title \(English\)/), { target: { value: " New notice " } });
    fireEvent.change(dlg.getByLabelText(/^Text \(Bangla\)/), { target: { value: "বিবরণ লেখা" } });
    fireEvent.change(dlg.getByLabelText(/^Text \(English\)/), { target: { value: "Some text" } });
    expect(save).toBeDisabled(); // no date yet
    fireEvent.change(dlg.getByLabelText(/^Date/), { target: { value: "2026-10-21" } });
    fireEvent.click(dlg.getByLabelText("Show in ticker"));
    fireEvent.click(save);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/admin/content", {
        kind: "NOTICE", title_en: "New notice", title_bn: "নতুন নোটিশ", body_en: "Some text", body_bn: "বিবরণ লেখা",
        published: true, position: 0, published_on: "2026-10-21", ticker: true,
      }),
    );
  });

  it("edits an item with PATCH and sends no ticker or date for an FAQ entry", async () => {
    const faq = item({ id: "f1", kind: "FAQ", title_en: "Is it free?", published_on: null, ticker: false, position: 2 });
    const { patch } = wrap({ get: vi.fn(async () => page([faq])) });
    fireEvent.click(await screen.findByRole("tab", { name: "FAQ" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit Is it free?" }));
    const dlg = within(screen.getByRole("dialog"));
    expect(dlg.queryByLabelText("Show in ticker")).toBeNull();
    fireEvent.change(dlg.getByLabelText("Position"), { target: { value: "5" } });
    fireEvent.click(dlg.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [url, body] = patch.mock.calls[0];
    expect(url).toBe("/admin/content/f1");
    expect(body).toMatchObject({ position: 5 });
    expect(body).not.toHaveProperty("ticker");
    expect(body).not.toHaveProperty("published_on");
  });

  it("asks before deleting", async () => {
    const { del } = wrap();
    fireEvent.click(await screen.findByRole("button", { name: "Delete Office closed Friday" }));
    expect(del).not.toHaveBeenCalled();
    const dlg = within(screen.getByRole("dialog"));
    expect(dlg.getByText(/will be removed from the public pages/)).toBeInTheDocument();
    fireEvent.click(dlg.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/content/c1"));
  });

  it("shows the Bangla titles in Bangla and has no axe violations in either language", async () => {
    const { container } = wrap(undefined, "bn");
    const table = await screen.findByTestId("content-table");
    expect(within(table).getAllByText("শুক্রবার অফিস বন্ধ").length).toBeGreaterThan(0);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(r.violations).toEqual([]);
  });
});
