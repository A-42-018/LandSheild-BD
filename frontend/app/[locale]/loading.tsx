"use client";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/ui";

/** Route loading fallback. Shown only if the page takes longer than ~300 ms, so quick page changes do not flash "Processing…". */
export default function Loading() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  return show ? <LoadingState /> : <div aria-hidden="true" className="min-h-[50vh]" />;
}
