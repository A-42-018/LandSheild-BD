import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Badge, Button, Card, Input, Select } from "./index";

describe("Button", () => {
  it("has an accessible name and defaults to type=button", () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveAttribute("data-variant", "primary");
  });
  it("renders variants", () => {
    render(<Button variant="danger">Del</Button>);
    expect(screen.getByRole("button", { name: "Del" })).toHaveAttribute("data-variant", "danger");
  });
  it("loading disables and sets aria-busy; click works otherwise", () => {
    const fn = vi.fn();
    const { rerender } = render(<Button onClick={fn}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(fn).toHaveBeenCalledTimes(1);
    rerender(<Button loading onClick={fn}>Go</Button>);
    const b = screen.getByRole("button", { name: "Go" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });
  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>R</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("Input", () => {
  it("label gives the input its accessible name", () => {
    render(<Input label="Khatian No" />);
    expect(screen.getByRole("textbox", { name: "Khatian No" })).toBeInTheDocument();
  });
  it("wires hint and error via aria-describedby and flags invalid", () => {
    render(<Input label="Dag" hint="Digits only" error="Required" />);
    const i = screen.getByRole("textbox", { name: "Dag" });
    expect(i).toHaveAttribute("aria-invalid", "true");
    const ids = i.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0])).toHaveTextContent("Digits only");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
  it("no aria-invalid without error", () => {
    render(<Input label="X" />);
    const i = screen.getByRole("textbox", { name: "X" });
    expect(i).not.toHaveAttribute("aria-invalid");
    expect(i).not.toHaveAttribute("aria-describedby");
  });
});

describe("Select", () => {
  it("is labelled, lists options and placeholder, reports error", () => {
    render(
      <Select
        label="District"
        placeholder="Choose"
        error="Pick one"
        options={[{ value: "dhaka", label: "Dhaka" }, { value: "ctg", label: "Chattogram" }]}
      />,
    );
    const s = screen.getByRole("combobox", { name: "District" });
    expect(s).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.change(s, { target: { value: "ctg" } });
    expect((s as HTMLSelectElement).value).toBe("ctg");
  });
});

describe("Card & Badge", () => {
  it("Card renders title, body, footer", () => {
    render(<Card title="T" footer="F">Body</Card>);
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });
  it("Badge tone variants", () => {
    render(<Badge tone="critical">x</Badge>);
    expect(screen.getByText("x")).toHaveAttribute("data-tone", "critical");
  });
});
