import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import QrScanner, { canScanQr } from "./QrScanner";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);

const stop = vi.fn();
const getUserMedia = vi.fn();

function install(detect?: () => Promise<{ rawValue: string }[]>) {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  if (detect) {
    (window as unknown as Record<string, unknown>).BarcodeDetector = class {
      detect = detect;
    };
  }
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
}

beforeEach(() => {
  stop.mockClear();
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop }] });
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).BarcodeDetector;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

describe("QR camera scan (U5.1)", () => {
  it("is hidden where the browser cannot read QR codes", () => {
    install();
    expect(canScanQr()).toBe(false);
    render(wrap(<QrScanner onResult={vi.fn()} />));
    expect(screen.queryByTestId("qr-scanner")).toBeNull();
  });

  it("opens the rear camera, hands the code over once and releases the camera", async () => {
    install(() => Promise.resolve([{ rawValue: "https://x.test/en/v/LP-10100" }]));
    const onResult = vi.fn();
    render(wrap(<QrScanner onResult={onResult} />));
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: en.home.search.qrScan }));
    });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("https://x.test/en/v/LP-10100"));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ video: { facingMode: { ideal: "environment" } }, audio: false });
    expect(stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: en.home.search.qrScan })).toBeInTheDocument();
  });

  it("explains a blocked camera and falls back to the paste field", async () => {
    install(() => Promise.resolve([]));
    getUserMedia.mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    render(wrap(<QrScanner onResult={vi.fn()} />));
    fireEvent.click(await screen.findByRole("button", { name: en.home.search.qrScan }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.home.search.qrScanDenied);
    expect(screen.getByRole("button", { name: en.home.search.qrScan })).toBeInTheDocument();
  });

  it("closing the panel stops the camera", async () => {
    install(() => Promise.resolve([]));
    render(wrap(<QrScanner onResult={vi.fn()} />));
    fireEvent.click(await screen.findByRole("button", { name: en.home.search.qrScan }));
    fireEvent.click(await screen.findByRole("button", { name: en.home.search.qrScanStop }));
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
