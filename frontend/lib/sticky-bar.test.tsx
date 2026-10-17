import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStickyBar } from "./sticky-bar";

function Bar({ position, show = true }: { position: "sticky" | "static"; show?: boolean }) {
  const ref = useStickyBar();
  return show ? <div ref={ref} style={{ position }} data-testid="bar" /> : null;
}
const height = () => document.documentElement.style.getPropertyValue("--sticky-bar-h");

describe("useStickyBar (U5.4)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("puts a sticky bar's height on <html> and clears it when the bar goes away", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 168.4 } as DOMRect);
    const { rerender } = render(<Bar position="sticky" />);
    expect(height()).toBe("169px");
    rerender(<Bar position="sticky" show={false} />);
    expect(height()).toBe("");
  });

  it("a static bar (result and report from sm) asks for no room", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 80 } as DOMRect);
    render(<Bar position="static" />);
    expect(height()).toBe("0px");
  });

  it("measures again when the window is resized", () => {
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 60 } as DOMRect);
    render(<Bar position="sticky" />);
    rect.mockReturnValue({ height: 120 } as DOMRect);
    window.dispatchEvent(new Event("resize"));
    expect(height()).toBe("120px");
  });
});
