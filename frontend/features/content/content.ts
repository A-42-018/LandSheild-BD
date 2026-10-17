"use client";
import { useEffect, useState } from "react";
import { createApiClient } from "@/lib/api";

export const CONTENT_KINDS = ["NOTICE", "FAQ", "GUIDE"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export interface PublicContent {
  id: string;
  kind: ContentKind;
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  published_on: string | null;
  ticker: boolean;
  position: number;
}

export interface AdminContent extends PublicContent {
  published: boolean;
  created_at: string;
  updated_at: string;
}

/** Pick the text for the current language. */
export const pick = (c: PublicContent, locale: string, field: "title" | "body") =>
  locale === "bn" ? c[`${field}_bn`] : c[`${field}_en`];

const api = createApiClient();
const inflight = new Map<ContentKind, Promise<PublicContent[] | null>>();

function load(kind: ContentKind): Promise<PublicContent[] | null> {
  let p = inflight.get(kind);
  if (!p) {
    p = api
      .request<{ items: PublicContent[] }>(`/content?kind=${kind}`, { anonymous: true })
      .then((r) => r.items)
      .catch(() => null)
      .finally(() => setTimeout(() => inflight.delete(kind), 30_000)); // the ticker and the board share one request
    inflight.set(kind, p);
  }
  return p;
}

/** Published items of one kind, or `null` until they arrive or when the server cannot be reached (callers then show the built-in copy).
 *  Pages are statically generated, so this runs in the browser after mount. */
export function usePublicContent(kind: ContentKind): PublicContent[] | null {
  const [items, setItems] = useState<PublicContent[] | null>(null);
  useEffect(() => {
    let live = true;
    void load(kind).then((r) => { if (live && r) setItems(r); });
    return () => { live = false; };
  }, [kind]);
  return items;
}
