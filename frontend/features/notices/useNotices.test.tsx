import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import { FAQ_IDS } from "@/features/info/pages";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const row = (o: any) => ({ id: "x", kind: "NOTICE", title_en: "", title_bn: "", body_en: "b", body_bn: "ব", published_on: "2026-10-20", ticker: false, position: 0, ...o });

function serve(byKind: Record<string, any[] | "down">) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const kind = new URL(url).searchParams.get("kind")!;
    const v = byKind[kind];
    if (v === "down") throw new Error("offline");
    return new Response(JSON.stringify({ items: v }), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
}
const wrap = (ui: any, locale: "en" | "bn" = "en") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>{ui}</NextIntlClientProvider>
);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetModules(); });

// the module caches a request for 30 s, so each test loads a fresh copy of the components
async function fresh() {
  vi.resetModules();
  const [{ NoticeBoard }, NT, FL] = await Promise.all([import("@/features/landing/Sections"), import("@/components/NoticeTicker"), import("@/features/info/FaqList")]);
  return { NoticeBoard, NoticeTicker: NT.default, FaqList: FL.default };
}

describe("public content from the server (U3.6)", () => {
  it("the board and the ticker show the admin's notices; only flagged ones scroll", async () => {
    serve({ NOTICE: [row({ id: "a1", title_en: "Fresh notice", ticker: true }), row({ id: "a2", title_en: "Board only" })] });
    const c = await fresh();
    render(wrap(<><c.NoticeTicker /><c.NoticeBoard /></>));
    await waitFor(() => expect(screen.getAllByText("Fresh notice").length).toBeGreaterThan(0));
    expect(screen.getAllByTestId("notice-item")).toHaveLength(2);
    expect(screen.getByText("Board only")).toBeInTheDocument(); // on the board, not in the ticker
    expect(screen.queryByText("Board only", { selector: "a span" })).toBeNull();
    expect(document.getElementById("notice-a1")).not.toBeNull();
    expect(screen.queryByText(en.landing.notices.items.n1.title)).toBeNull(); // built-in sample is gone
  });

  it("Bangla visitors get the Bangla title", async () => {
    serve({ NOTICE: [row({ id: "a1", title_en: "English", title_bn: "বাংলা শিরোনাম" })] });
    const c = await fresh();
    render(wrap(<c.NoticeBoard />, "bn"));
    expect(await screen.findByText("বাংলা শিরোনাম")).toBeInTheDocument();
  });

  it("an empty server list means no notices, and the ticker hides", async () => {
    serve({ NOTICE: [] });
    const c = await fresh();
    render(wrap(<><c.NoticeTicker /><c.NoticeBoard /></>));
    expect(await screen.findByText(en.landing.notices.empty)).toBeInTheDocument();
    expect(screen.queryByTestId("notice-ticker")).toBeNull();
  });

  it("falls back to the built-in notices when the server is unreachable", async () => {
    serve({ NOTICE: "down" });
    const c = await fresh();
    render(wrap(<c.NoticeBoard />));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByTestId("notice-item")).toHaveLength(4);
  });

  it("FAQ shows the admin's answers, limited for the home page, and keeps the built-in ones while none exist", async () => {
    serve({ FAQ: [row({ id: "f1", kind: "FAQ", title_en: "Q one?", body_en: "A one" }), row({ id: "f2", kind: "FAQ", title_en: "Q two?" }), row({ id: "f3", kind: "FAQ", title_en: "Q three?" })] });
    let c = await fresh();
    render(wrap(<c.FaqList ids={FAQ_IDS} limit={2} testId="q" />));
    await waitFor(() => expect(screen.getAllByTestId("q")).toHaveLength(2));
    expect(screen.getByText("Q one?")).toBeInTheDocument();
    cleanup();
    serve({ FAQ: [] });
    c = await fresh();
    render(wrap(<c.FaqList ids={FAQ_IDS} testId="q" />));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByTestId("q")).toHaveLength(FAQ_IDS.length);
  });
});

