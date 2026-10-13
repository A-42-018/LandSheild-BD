"use client";
import { useId, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGisSearch } from "./useGis";
import { gisLabel, type SearchHitDto } from "./types";

export interface PlaceSearchProps {
  onPick: (hit: SearchHitDto) => void;
  placeholder: string;
  noneText: string;
  /** Only these hit levels are listed; all levels when omitted. */
  levels?: SearchHitDto["level"][];
  /** Shown under the hits when the API says mouza search did not cover the query. */
  scopeNote?: string;
}

/** Place name / JL no. search (English or Bangla) used by the parcel map and the mouza map. */
export default function PlaceSearch({ onPick, placeholder, noneText, levels, scopeNote }: PlaceSearchProps) {
  const t = useTranslations("map.gis");
  const id = useId();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useGisSearch(submitted);
  const hits = (search.data?.hits ?? []).filter((h) => !levels || levels.includes(h.level));

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-col gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term.trim());
        }}
      >
        <label htmlFor={id} className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="flex items-stretch gap-1.5">
          <input
            id={id}
            type="search"
            value={term}
            placeholder={placeholder}
            onChange={(e) => setTerm(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <button
            type="submit"
            aria-label={t("searchButton")}
            title={t("searchButton")}
            disabled={term.trim().length < 2}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </form>
      {submitted.length >= 2 && (
        <div aria-live="polite" className="text-sm">
          {search.isPending ? (
            <p className="text-ink-muted">{t("searching")}</p>
          ) : search.isError ? (
            <p className="text-critical">{t("searchError")}</p>
          ) : hits.length === 0 ? (
            <p className="text-ink-muted">{noneText}</p>
          ) : (
            <ul className="flex max-h-48 flex-col overflow-auto rounded-md border border-line">
              {hits.map((h) => (
                <li key={`${h.level}-${h.id}`} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-surface-muted"
                    onClick={() => onPick(h)}
                  >
                    <span className="font-medium">{gisLabel(h)}</span>{" "}
                    <span className="text-xs text-ink-muted">
                      {t(`level.${h.level}`)}
                      {h.jl_no ? ` · ${t("jlShort", { jl: h.jl_no })}` : ""}
                      {h.path ? ` · ${h.path}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {scopeNote && hits.length > 0 && search.data?.out_of_scope_hint && (
            <p className="mt-1 text-xs text-ink-muted">{scopeNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
