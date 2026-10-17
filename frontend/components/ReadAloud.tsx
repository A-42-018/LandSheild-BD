"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui";
import { canSpeak, pickVoice, readableText, speechLang } from "@/lib/speech";

/** Only one reader at a time: starting a new one resets the button of the one before. */
let stopActive: (() => void) | null = null;

export interface ReadAloudProps {
  /** `id` of the element whose visible text is read. */
  targetId: string;
  /** What is being read, e.g. "Result". Added to the button's accessible name after the visible word. */
  subject?: string;
  className?: string;
}

type Phase = "idle" | "speaking";

/** "শুনুন" button (U4.4): reads the visible text of one region with the browser's own voice for the page language.
 *  Renders nothing on browsers without speech synthesis. When the device has voices but none for Bangla (common on
 *  desktops), it shows one plain sentence instead of a button that would stay silent or read in the wrong language. */
export default function ReadAloud({ targetId, subject, className }: ReadAloudProps) {
  const t = useTranslations("readAloud");
  const locale = useLocale();
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const run = useRef(0);

  useEffect(() => {
    if (!canSpeak()) return;
    setSupported(true);
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    // Chrome fills the voice list after the page loads.
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    // Cancel only our own speech: another reader may be talking when this one unmounts.
    if (stopActive === stop) {
      stopActive = null;
      if (canSpeak()) window.speechSynthesis.cancel();
    }
    setPhase("idle");
  }, []);

  // Silence when the visitor leaves the page or switches language.
  useEffect(() => stop, [stop, locale]);

  const start = () => {
    const pieces = readableText(document.getElementById(targetId), locale);
    if (!pieces.length) return;
    stopActive?.();
    window.speechSynthesis.cancel();
    const mine = (run.current += 1);
    stopActive = stop;
    const voice = pickVoice(voices, locale);
    pieces.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang ?? speechLang(locale);
      if (voice) u.voice = voice;
      const done = () => {
        if (run.current === mine && i === pieces.length - 1) stop();
      };
      u.onend = done;
      u.onerror = () => {
        if (run.current === mine) stop();
      };
      window.speechSynthesis.speak(u);
    });
    setPhase("speaking");
  };

  if (!supported) return null;

  if (voices.length > 0 && !pickVoice(voices, locale)) {
    return (
      <p className={`flex items-start gap-2 text-sm text-ink-muted print:hidden ${className ?? ""}`} data-testid="read-aloud-novoice" data-no-speech>
        <VolumeX aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        {t("noVoice")}
      </p>
    );
  }

  const speaking = phase === "speaking";
  const word = t(speaking ? "stop" : "listen");
  return (
    <Button
      variant="secondary"
      size="sm"
      data-testid="read-aloud"
      data-state={phase}
      className={`print:hidden ${className ?? ""}`}
      icon={speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      aria-label={subject ? t(speaking ? "stopNamed" : "listenNamed", { subject }) : undefined}
      onClick={speaking ? stop : start}
    >
      {word}
    </Button>
  );
}
