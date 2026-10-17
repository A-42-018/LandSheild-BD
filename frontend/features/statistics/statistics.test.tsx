import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import { DIVISIONS } from "@/lib/geo";
import { SITEMAP_GROUPS } from "@/features/info/pages";
import StatisticsPage from "./StatisticsPage";
import { DIVISION_ROWS, SAMPLE_UPDATED, TILE_POSITION, bandOf, totals } from "./sample";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const show = (locale: "en" | "bn") =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      <StatisticsPage />
    </NextIntlClientProvider>,
  );

describe("public তথ্যচিত্র (U4.3)", () => {
  it("says plainly that the figures are sample data, not a government record", () => {
    show("bn");
    const note = screen.getByTestId("sample-notice");
    expect(note).toHaveAttribute("role", "note");
    expect(note).toHaveTextContent(bn.statistics.sampleBody);
    expect(bn.statistics.sampleBody).toContain("সরকারি রেকর্ড");
    expect(within(note).getByRole("link")).toHaveAttribute("href", "/data-sources");
    expect(screen.getByText(bn.statistics.sampleBadge)).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveAccessibleName(bn.statistics.tableCaption);
  });

  it("shows the সর্বশেষ হালনাগাদ date in the page language", () => {
    show("bn");
    const date = new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${SAMPLE_UPDATED}T00:00:00Z`));
    expect(screen.getByText(`সর্বশেষ হালনাগাদ: ${date}`)).toBeInTheDocument();
  });

  it("uses only Bangla digits under bn", () => {
    const { container } = show("bn");
    expect(container.textContent).not.toMatch(/[0-9]/);
  });

  it("KPI totals match the division table", () => {
    show("en");
    const sum = totals();
    const n = new Intl.NumberFormat("en");
    expect(screen.getByTestId("stat-verifications")).toHaveTextContent(n.format(sum.verifications));
    expect(screen.getByTestId("stat-applications")).toHaveTextContent(n.format(sum.applications));
    expect(screen.getByTestId("stat-settled")).toHaveTextContent(n.format(sum.settled));
    expect(screen.getByTestId("stat-settledShare")).toHaveTextContent(`${Math.round(sum.settledShare * 100)}%`);
    const foot = screen.getByRole("table").querySelector("tfoot")!;
    expect(foot).toHaveTextContent(`${en.statistics.col.total}${n.format(sum.verifications)}${n.format(sum.applications)}${n.format(sum.settled)}`);
  });

  it("covers all eight divisions on the map and in the table, each tile with its number", () => {
    show("bn");
    expect(DIVISION_ROWS.map((r) => r.id).sort()).toEqual(DIVISIONS.map((d) => d.value).sort());
    const tiles = within(screen.getByTestId("division-map")).getAllByRole("listitem").filter((li) => li.dataset.band);
    expect(tiles).toHaveLength(8);
    const n = new Intl.NumberFormat("bn-BD");
    DIVISION_ROWS.forEach((r, i) => {
      const bnName = DIVISIONS.find((d) => d.value === r.id)!.bn;
      expect(tiles[i]).toHaveTextContent(`${bnName}${n.format(r.verifications)}`);
      expect(tiles[i].dataset.band).toBe(bandOf(r.verifications));
      expect(screen.getByRole("rowheader", { name: bnName })).toBeInTheDocument();
    });
    // one cell per division on the 3 × 3 grid
    const cells = new Set(Object.values(TILE_POSITION).map((p) => `${p.row}/${p.col}`));
    expect(cells.size).toBe(8);
  });

  it("uses theme tokens only, no hex colours", () => {
    const dir = join(process.cwd(), "features/statistics");
    for (const f of readdirSync(dir).filter((x) => !x.includes(".test."))) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    }
  });

  it("is linked from the footer and the sitemap", () => {
    const footer = readFileSync(join(process.cwd(), "features/landing/Footer.tsx"), "utf8");
    expect(footer).toContain('href="/statistics"');
    expect(SITEMAP_GROUPS.flatMap((g) => g.links.map(([href]) => href as string))).toContain("/statistics");
  });
});
