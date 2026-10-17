"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

const detectorCtor = (): DetectorCtor | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

/** The browser can read QR codes itself (Chromium on Android and desktop). Safari/Firefox phones open QR links from the camera app instead. */
export function canScanQr(): boolean {
  return Boolean(detectorCtor() && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia);
}

/**
 * U5.1: "scan with camera" for the QR check. No library: the built-in BarcodeDetector does the reading, so the page ships no
 * extra JS. The button only appears where the browser supports it; the paste field stays the fallback. The stream never leaves
 * the device and is stopped as soon as a code is read, the panel is closed or the component unmounts.
 */
export default function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const t = useTranslations("home.search");
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<"denied" | "failed" | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(onResult);
  done.current = onResult;

  useEffect(() => setSupported(canScanQr()), []);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    (async () => {
      try {
        const Ctor = detectorCtor()!;
        const detector = new Ctor({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) return stop();
        const el = video.current;
        if (!el) return stop();
        el.srcObject = stream;
        await el.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const hit = (await detector.detect(el))[0];
            if (hit?.rawValue) {
              stop();
              setOpen(false);
              done.current(hit.rawValue);
              return;
            }
          } catch {
            /* a frame that cannot be read is skipped */
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch (e) {
        stop();
        setOpen(false);
        setError((e as DOMException)?.name === "NotAllowedError" ? "denied" : "failed");
      }
    })();
    return stop;
  }, [open]);

  if (!supported) return null;
  return (
    <div className="flex flex-col gap-3" data-testid="qr-scanner">
      {open ? (
        <div className="flex flex-col gap-2">
          <video
            ref={video}
            muted
            playsInline
            aria-label={t("qrScanning")}
            className="aspect-square w-full max-w-sm rounded-xl border border-line bg-black object-cover"
          />
          <p role="status" className="text-sm text-ink-muted">{t("qrScanning")}</p>
          <Button type="button" variant="secondary" size="lg" icon={<X />} onClick={() => setOpen(false)} className="w-full sm:w-auto sm:self-start">
            {t("qrScanStop")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          icon={<Camera />}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="w-full sm:w-auto sm:self-start"
        >
          {t("qrScan")}
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-critical">{t(error === "denied" ? "qrScanDenied" : "qrScanFailed")}</p>}
    </div>
  );
}
