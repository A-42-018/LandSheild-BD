import { useState, type FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui";
import { focusFirstInvalid, useFocusFirstInvalid } from "./focus-first-invalid";

describe("focusFirstInvalid", () => {
  it("focuses the first enabled aria-invalid field in document order", () => {
    render(
      <form data-testid="f">
        <input aria-label="a" />
        <input aria-label="b" aria-invalid="true" disabled />
        <input aria-label="c" aria-invalid="true" />
        <input aria-label="d" aria-invalid="true" />
      </form>,
    );
    expect(focusFirstInvalid(screen.getByTestId("f"))).toBe(true);
    expect(screen.getByLabelText("c")).toHaveFocus();
  });

  it("does nothing when no field is invalid or there is no root", () => {
    render(<form data-testid="f"><input aria-label="a" aria-invalid="false" /></form>);
    expect(focusFirstInvalid(screen.getByTestId("f"))).toBe(false);
    expect(focusFirstInvalid(null)).toBe(false);
    expect(document.body).toHaveFocus();
  });
});

/** A hand-rolled form like most in the app: errors live in state and only render after submit. */
function Demo() {
  const [v, setV] = useState({ a: "", b: "" });
  const [touched, setTouched] = useState(false);
  const focus = useFocusFirstInvalid();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!v.a || !v.b) focus.request();
  };
  return (
    <form ref={focus.ref} onSubmit={submit} noValidate>
      <Input label="First" value={v.a} onChange={(e) => setV({ ...v, a: e.target.value })} error={touched && !v.a ? "required" : undefined} />
      <Input label="Second" value={v.b} onChange={(e) => setV({ ...v, b: e.target.value })} error={touched && !v.b ? "required" : undefined} />
      <button type="submit">Go</button>
    </form>
  );
}

describe("useFocusFirstInvalid", () => {
  it("focuses the first wrong field after the errors render, and again on a repeat submit", () => {
    render(<Demo />);
    const go = screen.getByRole("button", { name: "Go" });
    go.focus();
    fireEvent.click(go);
    expect(screen.getByLabelText("First")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("First"), { target: { value: "x" } });
    go.focus();
    fireEvent.click(go);
    expect(screen.getByLabelText("Second")).toHaveFocus();

    // same errors already showing: the request alone must still move focus back
    go.focus();
    fireEvent.click(go);
    expect(screen.getByLabelText("Second")).toHaveFocus();
  });

  it("leaves focus alone on a valid submit", () => {
    render(<Demo />);
    fireEvent.change(screen.getByLabelText("First"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Second"), { target: { value: "y" } });
    const go = screen.getByRole("button", { name: "Go" });
    go.focus();
    fireEvent.click(go);
    expect(go).toHaveFocus();
  });
});

/** react-hook-form style: the errors arrive one render after the request; a stray request expires. */
function Late() {
  const [phase, setPhase] = useState(0);
  const [, setOther] = useState(0);
  const focus = useFocusFirstInvalid();
  return (
    <form ref={focus.ref}>
      <input aria-label="field" aria-invalid={phase >= 1 ? true : undefined} />
      <button type="button" onClick={() => { focus.request(); queueMicrotask(() => setPhase(1)); }}>late</button>
      <button type="button" onClick={focus.request}>stray</button>
      <button type="button" onClick={() => setOther((n) => n + 1)}>other</button>
      <button type="button" onClick={() => setPhase(2)}>later</button>
    </form>
  );
}

describe("useFocusFirstInvalid timing", () => {
  it("waits for errors that render one step after the request", async () => {
    render(<Late />);
    fireEvent.click(screen.getByRole("button", { name: "late" }));
    await screen.findByRole("textbox", { name: "field" });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByLabelText("field")).toHaveFocus();
  });

  it("drops a request that found nothing, so later errors do not steal focus", () => {
    render(<Late />);
    const stray = screen.getByRole("button", { name: "stray" });
    stray.focus();
    fireEvent.click(stray);
    const other = screen.getByRole("button", { name: "other" });
    other.focus();
    fireEvent.click(other); // a second render, still nothing marked: the request expires
    const later = screen.getByRole("button", { name: "later" });
    later.focus();
    fireEvent.click(later);
    expect(screen.getByLabelText("field")).toHaveAttribute("aria-invalid", "true");
    expect(later).toHaveFocus();
  });
});
