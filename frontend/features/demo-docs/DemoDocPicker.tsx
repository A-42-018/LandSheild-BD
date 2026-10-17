"use client";
import { Fragment, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertCircle, FolderOpen, Info, Loader2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { DEMO_DOC_DIR, fetchDemoFile, type DemoDoc } from "./catalog";

export interface DemoDocPickerProps<D extends DemoDoc> {
  docs: D[];
  onPick: (file: File, doc: D) => void;
  disabled?: boolean;
}

/** "Choose from sample documents": a small file-browser dialog. Picking a sample attaches a real file to the
 *  form exactly like a file from the user's own device; nothing about the result is shown in advance. */
export default function DemoDocPicker<D extends DemoDoc>({ docs, onPick, disabled }: DemoDocPickerProps<D>) {
  const t = useTranslations("demoDocs");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);

  function close() {
    latest.current++; // a fetch still running after the dialog closed must not attach anything
    setLoading(null);
    setOpen(false);
  }

  async function pick(d: D) {
    const req = ++latest.current;
    setLoading(d.key);
    setFailed(false);
    try {
      const file = await fetchDemoFile(d);
      if (req !== latest.current) return;
      setLoading(null);
      setOpen(false);
      onPick(file, d);
    } catch {
      if (req !== latest.current) return;
      setLoading(null);
      setFailed(true);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<FolderOpen />}
        disabled={disabled}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        data-testid="demo-picker-open"
      >
        {t("open")}
      </Button>

      {/* portal: the form's glass card (backdrop-filter) would otherwise trap the fixed overlay */}
      {open &&
        createPortal(
          <Modal open onClose={close} title={t("title")} className="!max-w-xl">
            <p className="flex items-start gap-2 rounded-lg bg-primary-soft/60 px-3 py-2 text-sm text-ink">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {t("note")}
            </p>
            <ul data-testid="demo-picker" className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {docs.map((d) => {
                const busy = loading === d.key;
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      data-testid={`demo-doc-${d.key}`}
                      aria-busy={busy || undefined}
                      disabled={loading !== null}
                      onClick={() => pick(d)}
                      className="group flex w-full flex-col items-center gap-1.5 rounded-xl border border-transparent p-1.5 text-center transition hover:border-primary/40 hover:bg-primary-soft/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 disabled:cursor-wait"
                    >
                      <span className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-line bg-white shadow-raised">
                        <img src={`${DEMO_DOC_DIR}/${d.file}`} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                        {busy && (
                          <span className="absolute inset-0 grid place-items-center bg-surface/75">
                            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
                            <span className="sr-only">{t("loading")}</span>
                          </span>
                        )}
                      </span>
                      <span className="w-full text-xs leading-tight text-ink">
                        {d.name.split("_").map((part, i) => (
                          <Fragment key={i}>
                            {i > 0 && <>_<wbr /></>}
                            {part}
                          </Fragment>
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {failed && (
              <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-critical">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {t("loadError")}
              </p>
            )}
          </Modal>,
          document.body,
        )}
    </>
  );
}
