import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import { pickVoice, readableText } from "@/lib/speech";
import ReadAloud from "./ReadAloud";

type Voice = { lang: string; name: string };
const voice = (lang: string): SpeechSynthesisVoice => ({ lang, name: lang }) as SpeechSynthesisVoice;

/** Minimal speechSynthesis: records what is spoken and lets a test finish or cancel it. */
function installSpeech(voices: Voice[]) {
  const spoken: any[] = [];
  const synth = {
    speak: vi.fn((u: any) => spoken.push(u)),
    cancel: vi.fn(() => spoken.splice(0).forEach((u) => u.onerror?.({ error: "canceled" }))),
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", synth);
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; voice: unknown = null; onend: (() => void) | null = null; onerror: ((e: unknown) => void) | null = null; constructor(public text: string) {} });
  return { synth, spoken };
}

const wrap = (locale: "en" | "bn", body: React.ReactNode = null) => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn}>
    <ReadAloud targetId="area" subject="Result" />
    <div id="area">{body ?? (
      <>
        <h2>Land record</h2>
        <p>Owner is Rahim Uddin</p>
        <p aria-hidden="true">decoration</p>
        <button>Print</button>
        <div data-no-speech>skip me</div>
      </>
    )}</div>
  </NextIntlClientProvider>
);

beforeEach(() => installSpeech([voice("bn-BD"), voice("en-US")]));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("readableText (U4.4)", () => {
  it("reads headings and paragraphs as separate sentences, and leaves out controls, hidden and marked parts", () => {
    render(wrap("en"));
    expect(readableText(document.getElementById("area"), "en")).toEqual(["Land record.", "Owner is Rahim Uddin."]);
  });

  it("ends Bangla lines with a danda and keeps existing end marks", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>জমির তথ্য</p><p>ঠিক আছে।</p><p>ঠিক আছে?</p>";
    expect(readableText(root, "bn")).toEqual(["জমির তথ্য।", "ঠিক আছে।", "ঠিক আছে?"]);
  });

  it("reads only the summary of a closed <details>, and everything once it is open", () => {
    const root = document.createElement("div");
    root.innerHTML = "<details><summary>Video</summary><p>Hidden steps</p></details>";
    expect(readableText(root, "en")).toEqual(["Video."]);
    root.querySelector("details")!.open = true;
    expect(readableText(root, "en")).toEqual(["Video.", "Hidden steps."]);
  });

  it("skips tab rows, images and video", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div role="tablist"><span>Ownership</span></div><p>Body</p><video>fallback text</video>`;
    expect(readableText(root, "en")).toEqual(["Body."]);
  });

  it("splits a long paragraph so no piece is over 180 characters", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>${Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ")}</p>`;
    const pieces = readableText(root, "en");
    expect(pieces.length).toBeGreaterThan(3);
    expect(pieces.every((p) => p.length <= 180)).toBe(true);
    expect(pieces.join(" ")).toContain("Sentence number 29 is here.");
  });

  it("returns nothing for a missing element", () => {
    expect(readableText(null, "en")).toEqual([]);
  });
});

describe("pickVoice", () => {
  it("prefers the exact Bangla locale, then any Bangla voice, never an English one", () => {
    expect(pickVoice([voice("en-US"), voice("bn-IN"), voice("bn-BD")], "bn")?.lang).toBe("bn-BD");
    expect(pickVoice([voice("en-US"), voice("bn_IN")], "bn")?.lang).toBe("bn_IN");
    expect(pickVoice([voice("en-US")], "bn")).toBeUndefined();
  });
});

describe("ReadAloud button (U4.4)", () => {
  it("says শুনুন in Bangla and Listen in English, with the subject in its accessible name", async () => {
    const { unmount } = render(wrap("bn"));
    expect(await screen.findByRole("button", { name: `${bn.readAloud.listen}: Result` })).toBeInTheDocument();
    unmount();
    render(wrap("en"));
    expect(await screen.findByRole("button", { name: `${en.readAloud.listen}: Result` })).toBeInTheDocument();
  });

  it("speaks each line in the page language, then becomes Stop", async () => {
    const { synth, spoken } = installSpeech([voice("bn-BD"), voice("en-US")]);
    render(wrap("bn", <><p>প্রথম লাইন</p><p>দ্বিতীয় লাইন</p></>));
    fireEvent.click(await screen.findByTestId("read-aloud"));
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(spoken.map((u) => u.text)).toEqual(["প্রথম লাইন।", "দ্বিতীয় লাইন।"]);
    expect(spoken.every((u) => u.lang === "bn-BD")).toBe(true);
    expect(screen.getByTestId("read-aloud")).toHaveAttribute("data-state", "speaking");
    expect(screen.getByRole("button", { name: `${bn.readAloud.stopNamed.replace("{subject}", "Result")}` })).toBeInTheDocument();
  });

  it("returns to Listen when the last line ends", async () => {
    const { spoken } = installSpeech([voice("en-US")]);
    render(wrap("en"));
    fireEvent.click(await screen.findByTestId("read-aloud"));
    act(() => spoken.forEach((u) => u.onend?.()));
    expect(screen.getByTestId("read-aloud")).toHaveAttribute("data-state", "idle");
  });

  it("Stop cancels the speech", async () => {
    const { synth } = installSpeech([voice("en-US")]);
    render(wrap("en"));
    fireEvent.click(await screen.findByTestId("read-aloud"));
    synth.cancel.mockClear();
    fireEvent.click(screen.getByTestId("read-aloud"));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByTestId("read-aloud")).toHaveAttribute("data-state", "idle");
  });

  it("goes quiet when the page is left", async () => {
    const { synth } = installSpeech([voice("en-US")]);
    const { unmount } = render(wrap("en"));
    fireEvent.click(await screen.findByTestId("read-aloud"));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("shows one plain sentence instead of a button when the device has no Bangla voice", async () => {
    installSpeech([voice("en-US")]);
    render(wrap("bn"));
    expect(await screen.findByTestId("read-aloud-novoice")).toHaveTextContent(bn.readAloud.noVoice);
    expect(screen.queryByTestId("read-aloud")).not.toBeInTheDocument();
  });

  it("renders nothing when the browser cannot speak", () => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "speechSynthesis");
    render(wrap("en"));
    expect(screen.queryByTestId("read-aloud")).not.toBeInTheDocument();
    expect(screen.queryByTestId("read-aloud-novoice")).not.toBeInTheDocument();
  });

  it("has no axe violations in either language", async () => {
    for (const l of ["en", "bn"] as const) {
      const { container, unmount } = render(wrap(l));
      await screen.findByTestId("read-aloud");
      const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(r.violations).toEqual([]);
      unmount();
    }
  });
});
