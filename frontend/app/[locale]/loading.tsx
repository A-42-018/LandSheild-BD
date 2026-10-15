"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";

/** Route loading fallback: a skeleton shaped like the page (hero band + two cards). Shown only after ~300 ms so quick page changes do not flash. */
export default function Loading() {
  const t = useTranslations("common");
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  if (!show) return <div aria-hidden="true" className="min-h-[50vh]" />;
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-40 !rounded-panel sm:h-44" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 !rounded-card" />
        <Skeleton className="h-48 !rounded-card" />
      </div>
    </div>
  );
}
