"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, SearchCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/navigation";
import { Button, Card, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { DISTRICTS, DIVISIONS, districtsOf, divisionOf, labelOf, upazilasOf } from "@/lib/geo";
import { useAuth } from "@/features/auth/AuthContext";
import { useGisSearch, useMouzas } from "@/features/map/gis/useGis";
import { verifySchema, type VerifyInput, type VerifyValues } from "./schema";

interface LandHit {
  land_id: string;
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, "");

/** Mouza names of the chosen upazila (from the map data) to suggest while typing; empty when unavailable. */
function useMouzaSuggestions(district: string, upazila: string): { value: string; label: string }[] {
  const { data: found } = useGisSearch(upazila);
  const hits = (found?.hits ?? []).filter((h) => h.level === "upazila" && fold(h.name) === fold(upazila));
  const hit = hits.find((h) => fold(h.path).includes(fold(district))) ?? (hits.length === 1 ? hits[0] : undefined);
  const { data } = useMouzas(hit?.id ?? "");
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const m of data?.mouzas ?? []) {
    const value = (m.name || m.bn_name).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: [m.jl_no ? `JL ${m.jl_no}` : "", m.bn_name && m.bn_name !== value ? m.bn_name : ""].filter(Boolean).join(" · ") });
  }
  return out;
}

/** `compact` (U5): landing-page hero variant — no card, no intro/hints, fields in a responsive grid. */
export default function VerifyForm({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("verify");
  const locale = useLocale();
  const router = useRouter();
  const { api } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VerifyInput, unknown, VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { district: "", upazila: "", mouza: "", khatian: "", dag: "" },
  });

  const district = watch("district") as string;
  // Division is a UI-only filter: picking one narrows the districts; picking a district fills it in.
  const [division, setDivision] = useState("");
  const districtOptions = division ? districtsOf(division) : DISTRICTS;
  const upazila = watch("upazila") as string;
  const mouzaNames = useMouzaSuggestions(district, upazila);
  const [mouzaOpen, setMouzaOpen] = useState(false);
  const mouzaValue = watch("mouza") as string;
  const mouzaField = register("mouza");
  const typed = fold(mouzaValue ?? "");
  const mouzaMatches = mouzaNames.filter((o) => !typed || fold(o.value).includes(typed)).slice(0, 50);
  const err = (k?: { message?: string }) => (k?.message ? t(`errors.${k.message}`) : undefined);

  const m = useMutation({
    mutationFn: (v: VerifyValues) => {
      const q = new URLSearchParams({
        district: v.district,
        upazila: v.upazila,
        mouza: v.mouza,
        khatian: v.khatian,
        dag: v.dag,
      });
      return api.get<LandHit>(`/lands/search?${q.toString()}`);
    },
    onSuccess: (land) => router.push(`/verify/result?land_id=${encodeURIComponent(land.land_id)}`),
  });

  const apiErr = (() => {
    const e = m.error;
    if (!e) return null;
    if (e instanceof ApiError) {
      if (e.status === 404 || e.code === "LAND_NOT_FOUND") return "notFound";
      if (e.status === 403) return "permission";
      if (e.code === "NETWORK_ERROR") return "network";
    }
    return "generic";
  })();

  const hint = compact ? undefined : t("numericHint");
  const form = (
      <form
        onSubmit={handleSubmit((v) => m.mutate(v))}
        noValidate
        aria-label={compact ? t("title") : undefined}
        className={compact ? "grid grid-cols-2 items-start gap-3 lg:grid-cols-7" : "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"}
      >
        {!compact && <p className="text-ink-muted sm:col-span-2 lg:col-span-3">{t("intro")}</p>}
        <Select
          label={t("division")}
          placeholder={t("selectDivision")}
          options={DIVISIONS.map((d) => ({ value: d.value, label: labelOf(d, locale) }))}
          value={division}
          onChange={(e) => {
            setDivision(e.target.value);
            setValue("district", "");
            setValue("upazila", "");
          }}
        />
        <Select
          label={t("district")}
          required
          placeholder={t("selectDistrict")}
          options={districtOptions.map((d) => ({ value: d.value, label: labelOf(d, locale) }))}
          error={err(errors.district)}
          {...register("district", {
            onChange: (e) => {
              setValue("upazila", "");
              if (e.target.value) setDivision(divisionOf(e.target.value));
            },
          })}
        />
        <Select
          label={t("upazila")}
          required
          disabled={!district}
          placeholder={t("selectUpazila")}
          options={upazilasOf(district).map((u) => ({ value: u.value, label: labelOf(u, locale) }))}
          error={err(errors.upazila)}
          {...register("upazila")}
        />
        <div className="relative flex flex-col">
          <Input
            label={t("mouza")}
            required
            autoComplete="off"
            role={mouzaNames.length ? "combobox" : undefined}
            aria-expanded={mouzaNames.length ? mouzaOpen && mouzaMatches.length > 0 : undefined}
            aria-controls={mouzaNames.length ? "mouza-suggestions" : undefined}
            error={err(errors.mouza)}
            {...mouzaField}
            onChange={(e) => {
              mouzaField.onChange(e);
              setMouzaOpen(true);
            }}
            onFocus={() => setMouzaOpen(true)}
            onBlur={(e) => {
              mouzaField.onBlur(e);
              setMouzaOpen(false);
            }}
            onKeyDown={(e) => e.key === "Escape" && setMouzaOpen(false)}
          />
          {mouzaOpen && mouzaMatches.length > 0 && (
            <ul
              id="mouza-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
            >
              {mouzaMatches.map((o) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === mouzaValue}
                  // mousedown (not click) so the input's blur doesn't close the list first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setValue("mouza", o.value, { shouldValidate: true });
                    setMouzaOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-ink hover:bg-primary/10"
                >
                  <span className="truncate">{o.value}</span>
                  {o.label && <span className="shrink-0 text-xs text-ink-muted">{o.label}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="contents">
          <Input
            label={t("khatian")}
            required
            inputMode="numeric"
            autoComplete="off"
            hint={hint}
            error={err(errors.khatian)}
            {...register("khatian")}
          />
          <Input
            label={t("dag")}
            required
            inputMode="numeric"
            autoComplete="off"
            hint={hint}
            error={err(errors.dag)}
            {...register("dag")}
          />
        </div>
        {apiErr && (
          <p role="alert" className="col-span-full text-sm text-critical">
            {apiErr === "generic" ? t("errors.generic") : t(`errors.${apiErr}`)}
          </p>
        )}
        <Button
          type="submit"
          loading={m.isPending}
          icon={<Search />}
          className={compact ? "mt-6 w-full" : "w-full sm:col-span-2 lg:col-span-3"}
        >
          {m.isPending ? t("searching") : t("submit")}
        </Button>
        {!compact && <p className="text-xs text-ink-muted sm:col-span-2 lg:col-span-3">{t("demoNote")}</p>}
      </form>
  );

  if (compact) return form;
  return (
    <Card title={t("title")} icon={<SearchCheck />} accent="primary">
      {form}
    </Card>
  );
}
