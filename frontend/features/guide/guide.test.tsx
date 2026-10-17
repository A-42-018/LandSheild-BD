import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import media from "./media.json";
import { GUIDES, GUIDE_IDS, STEP_IDS, guideAnchor, shotSrc, videoOf } from "./guides";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const PUBLIC = path.resolve(__dirname, "../../public");
const M = { en, bn } as const;
type Loc = keyof typeof M;

function serve(items: unknown[] | "down") {
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (items === "down") throw new Error("offline");
    return new Response(JSON.stringify({ items }), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
}

// MoreGuides shares a cached request per kind (30 s), so each test loads fresh modules
async function page(locale: Loc = "en") {
  vi.resetModules();
  const { default: GuidePage } = await import("./GuidePage");
  return render(
    <NextIntlClientProvider locale={locale} messages={M[locale]}>
      <main><GuidePage /></main>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => serve([]));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("/guide (U4.1)", () => {
  it("starts with one big tile per service, each jumping to its guide", async () => {
    await page();
    const tiles = screen.getAllByTestId("guide-tile");
    expect(tiles.map((a) => a.textContent)).toEqual(GUIDE_IDS.map((id) => en.guide.items[id].title));
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual(GUIDE_IDS.map((id) => `#${guideAnchor(id)}`));
    for (const id of GUIDE_IDS) expect(document.getElementById(guideAnchor(id))).not.toBeNull();
  });

  it("every guide has three pictured steps in the page language, then a button to the service", async () => {
    await page();
    const sections = screen.getAllByTestId("guide-section");
    expect(sections).toHaveLength(GUIDES.length);
    GUIDES.forEach((g, i) => {
      const s = within(sections[i]);
      const item = en.guide.items[g.id];
      expect(s.getByRole("heading", { level: 2, name: item.title })).toBeInTheDocument();
      const steps = s.getAllByTestId("guide-step");
      expect(steps).toHaveLength(3);
      STEP_IDS.forEach((step, n) => {
        const img = within(steps[n]).getByRole("img");
        expect(img).toHaveAttribute("src", `/guide/en/${g.id}-${step}.webp`);
        expect(img).toHaveAttribute("alt", item.steps[step].alt);
        expect(steps[n]).toHaveTextContent(`Step ${n + 1}`);
        expect(within(steps[n]).getByRole("heading", { level: 3, name: item.steps[step].title })).toBeInTheDocument();
      });
      expect(s.getByRole("link", { name: en.guide.tryIt.replace("{title}", item.title) })).toHaveAttribute("href", g.href);
      expect(s.getByText(g.signIn ? en.guide.signIn : en.guide.noSignIn)).toBeInTheDocument();
    });
  });

  it("Bangla: Bangla screenshots, Bangla step numbers and video length", async () => {
    await page("bn");
    const first = screen.getAllByTestId("guide-section")[0];
    const steps = within(first).getAllByTestId("guide-step");
    expect(within(steps[0]).getByRole("img")).toHaveAttribute("src", "/guide/bn/verify-s1.webp");
    expect(steps.map((s) => s.querySelector("p")?.textContent)).toEqual(["ধাপ ১", "ধাপ ২", "ধাপ ৩"]);
    const secs = String(media.verify.seconds).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
    expect(within(first).getByText(`ভিডিওতে দেখুন (${secs} সেকেন্ড)`)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ধাপ [0-9]/);
  });

  it("videos load nothing until played and carry captions in both languages, the page language first", async () => {
    const { container } = await page("en");
    const videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(GUIDE_IDS.length);
    videos.forEach((v, i) => {
      const id = GUIDE_IDS[i];
      expect(v).toHaveAttribute("preload", "none");
      expect(v).toHaveAttribute("poster", `/guide/video/${id}.webp`);
      expect(v.querySelector("source")).toHaveAttribute("src", `/guide/video/${id}.mp4`);
      const tracks = [...v.querySelectorAll("track")];
      expect(tracks.map((t) => [t.getAttribute("srclang"), t.getAttribute("kind"), t.hasAttribute("default")])).toEqual([
        ["bn", "captions", false],
        ["en", "captions", true],
      ]);
    });
  });

  it("no admin guides: nothing extra; admin guides (U3.6) are listed in the page language", async () => {
    await page();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("guide-more")).toBeNull();
    cleanup();

    serve([{ id: "g1", kind: "GUIDE", title_en: "Paying land tax", title_bn: "ভূমি কর দেওয়া", body_en: "Step one.\nStep two.", body_bn: "এক।", published_on: null, ticker: false, position: 0 }]);
    await page("bn");
    const more = await screen.findByTestId("guide-more");
    expect(within(more).getByRole("heading", { name: bn.guide.more.title })).toBeInTheDocument();
    expect(within(more).getByText("ভূমি কর দেওয়া")).toBeInTheDocument();
  });

  it("a server that cannot be reached leaves the picture guides as they are", async () => {
    serve("down");
    await page();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getAllByTestId("guide-section")).toHaveLength(GUIDES.length);
    expect(screen.queryByTestId("guide-more")).toBeNull();
  });

  it.each(["en", "bn"] as const)("no axe violations (%s)", async (locale) => {
    const { container } = await page(locale);
    const rules = Object.fromEntries(["color-contrast", "region", "landmark-one-main", "page-has-heading-one"].map((id) => [id, { enabled: false }]));
    const res = await axe.run(container, { rules, resultTypes: ["violations"] });
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
  });
});

describe("guide media on disk (made by scripts/guide_media.sh)", () => {
  it("a picture for every step in both languages", () => {
    for (const id of GUIDE_IDS) for (const step of STEP_IDS) for (const loc of ["bn", "en"]) {
      expect(fs.existsSync(path.join(PUBLIC, shotSrc(id, step, loc))), shotSrc(id, step, loc)).toBe(true);
    }
  });

  it("a video, poster and both caption files for every guide", () => {
    for (const id of GUIDE_IDS) {
      const v = videoOf(id);
      expect(v, `media.json has no entry for ${id}`).not.toBeNull();
      for (const f of [v!.src, v!.poster, v!.captions("bn"), v!.captions("en")]) expect(fs.existsSync(path.join(PUBLIC, f)), f).toBe(true);
      expect(fs.readFileSync(path.join(PUBLIC, v!.captions("bn")), "utf8")).toMatch(/^WEBVTT\n/);
    }
  });

  it("Bangla captions say what the page says", () => {
    const vtt = fs.readFileSync(path.join(PUBLIC, "guide/video/track.bn.vtt"), "utf8");
    expect(vtt).toContain(bn.guide.items.track.steps.s3.title);
  });
});

describe("links into the guide", () => {
  it("the What-you-need card on a service page links to that service's guide", async () => {
    const { default: WhatYouNeed } = await import("@/features/services/WhatYouNeed");
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <WhatYouNeed service="track" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId("guide-link")).toHaveAttribute("href", "/guide#guide-track");
    expect(screen.getByTestId("guide-link")).toHaveTextContent(en.services.guideLink);
  });
});

describe("read aloud (U4.4)", () => {
  const SPEECH = () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [{ lang: "en-US" }, { lang: "bn-BD" }], addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    return synth;
  };

  afterEach(() => Reflect.deleteProperty(window, "speechSynthesis"));

  it("every guide has its own Listen button; it reads the steps but not the links or the video", async () => {
    const synth = SPEECH();
    await page();
    for (const g of GUIDES) {
      expect(await screen.findByRole("button", { name: `${en.readAloud.listen}: ${en.guide.items[g.id].title}` })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: `${en.readAloud.listen}: ${en.guide.items.track.title}` }));
    const said = synth.speak.mock.calls.map(([u]) => u.text).join(" ");
    expect(said).toContain(en.guide.items.track.steps.s1.title);
    expect(said).not.toContain(en.guide.allGuides);
    expect(said).not.toContain(en.guide.video.unsupported);
  });

  it("has no Listen button where the browser cannot speak", async () => {
    await page();
    expect(screen.queryByTestId("read-aloud")).not.toBeInTheDocument();
  });
});
