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
        className={compact ? "grid grid-cols-2 items-start gap-3 lg:grid-cols-7" : "flex flex-col gap-4"}
      >
        {!compact && <p className="text-ink-muted">{t("intro")}</p>}
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
        <div className="flex flex-col">
          <Input
            label={t("mouza")}
            required
            autoComplete="off"
            list={mouzaNames.length ? "mouza-suggestions" : undefined}
            error={err(errors.mouza)}
            {...register("mouza")}
          />
          {mouzaNames.length > 0 && (
            <datalist id="mouza-suggestions">
              {mouzaNames.map((o) => (
                <option key={o.value} value={o.value} label={o.label} />
              ))}
            </datalist>
          )}
        </div>
        <div className={compact ? "contents" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
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
          <p role="alert" className={compact ? "col-span-full text-sm text-critical" : "text-sm text-critical"}>
            {apiErr === "generic" ? t("errors.generic") : t(`errors.${apiErr}`)}
          </p>
        )}
        <Button
          type="submit"
          loading={m.isPending}
          icon={<Search />}
          className={compact ? "mt-6 w-full" : "w-full"}
        >
          {m.isPending ? t("searching") : t("submit")}
        </Button>
        {!compact && <p className="text-xs text-ink-muted">{t("demoNote")}</p>}
      </form>
  );

  if (compact) return form;
  return (
    <Card title={t("title")} icon={<SearchCheck />} accent="primary">
      {form}
    </Card>
  );
}
