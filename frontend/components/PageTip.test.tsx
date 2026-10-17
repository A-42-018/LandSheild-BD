import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import PageTip, { PAGE_TIPS, TIP_STEPS, type PageTipId } from "./PageTip";

const wrap = (page: PageTipId, locale: "en" | "bn" = "bn") =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
      <PageTip page={page} />
    </NextIntlClientProvider>,
  );
const tips = (m: typeof en) => m.pageTip as unknown as Record<string, Record<string, string>>;

describe("PageTip (U4.2)", () => {
  it("starts closed with the question as its title, and opens on click", () => {
    wrap("verify");
    const details = screen.getByTestId("page-tip") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const summary = screen.getByText(bn.pageTip.title).closest("summary")!;
    expect(summary).toBeTruthy();
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    const items = details.querySelectorAll("li");
    expect([...items].map((li) => li.textContent)).toEqual(TIP_STEPS.map((s) => bn.pageTip.verify[s]));
  });

  it("is titled “এই পাতায় কী করবেন?” in Bangla", () => {
    expect(bn.pageTip.title).toBe("এই পাতায় কী করবেন?");
  });

  for (const [loc, m] of [["en", en], ["bn", bn as typeof en]] as const) {
    it(`every page has exactly three short steps (${loc})`, () => {
      const all = tips(m);
      expect(Object.keys(all).filter((k) => k !== "title").sort()).toEqual([...PAGE_TIPS].sort());
      for (const p of PAGE_TIPS) {
        expect(Object.keys(all[p]), p).toEqual([...TIP_STEPS]);
        for (const s of TIP_STEPS) {
          const text = all[p][s];
          expect(text.length, `${p}.${s}`).toBeGreaterThan(0);
          // copy rule (docs/ui.md): one idea per sentence, under 20 words
          for (const sentence of text.split(/[।.?!]\s*/).filter(Boolean)) {
            expect(sentence.trim().split(/\s+/).length, `${loc} ${p}.${s}`).toBeLessThan(20);
          }
          if (loc === "bn") expect(text, `${p}.${s}`).not.toMatch(/[0-9]/);
        }
      }
    });
  }

  it("is placed on the main citizen and officer pages", () => {
    const root = process.cwd();
    const read = (f: string) => readFileSync(join(root, f), "utf8");
    const where: Record<PageTipId, [string, string]> = {
      verify: ["app/[locale]/verify/page.tsx", 'tip="verify"'],
      check: ["app/[locale]/check/page.tsx", 'tip="check"'],
      verifyDoc: ["app/[locale]/verify-document/page.tsx", 'tip="verifyDoc"'],
      track: ["features/track/TrackView.tsx", 'tip="track"'],
      my: ["features/my/MyDashboard.tsx", '<PageTip page="my" />'],
      officer: ["features/officer/DashboardView.tsx", '<PageTip page="officer" />'],
      reviewer: ["features/reviewer/ReviewerHome.tsx", '<PageTip page="reviewer" />'],
      upload: ["app/[locale]/officer/upload/page.tsx", '<PageTip page="upload" />'],
      mutations: ["features/mutation/MutationQueue.tsx", '<PageTip page="mutations" />'],
    };
    for (const p of PAGE_TIPS) expect(read(where[p][0]), p).toContain(where[p][1]);
    expect(read("components/ServiceLayout.tsx")).toContain("{tip && <PageTip page={tip} />}");
  });

  it("renders in English too", () => {
    wrap("officer", "en");
    expect(screen.getByText(en.pageTip.title)).toBeInTheDocument();
  });
});
