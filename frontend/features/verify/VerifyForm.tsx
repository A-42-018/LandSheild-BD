"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, SearchCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/navigation";
import { Button, Card, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { DISTRICTS, DIVISIONS, districtsOf, divisionOf, labelOf, upazilasOf } from "@/lib/geo";
import { useAuth } from "@/features/auth/AuthContext";
import { useGisSearch, useMouzas } from "@/features/map/gis/useGis";
import PublicSummary, { type PublicLandSummary } from "./PublicSummary";
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

const FIELDS = ["district", "upazila", "mouza", "khatian", "dag"] as const;

/** `compact` (U5): landing-page hero variant — no card, no intro/hints, fields in a responsive grid.
 *  U1.3: anonymous hero searches go to `/verify?district=…`; the full form fills itself from that query and searches
 *  once when every field is valid.
 *  U2.2: signed-in users get the full result page; visitors get the masked public summary below the form. */
export default function VerifyForm({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("verify");
  const locale = useLocale();
  const router = useRouter();
  const { api, status } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VerifyInput, unknown, VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { district: "", upazila: "", mouza: "", khatian: "", dag: "" },
    // react-hook-form focuses in registration order, and mouza is registered first (mouzaField); see onInvalid
    shouldFocusError: false,
  });

  const district = watch("district") as string;
  // Division is a UI-only filter: picking one narrows the districts; picking a district fills it in.
  const [division, setDivision] = useState("");
  const districtOptions = division ? districtsOf(division) : DISTRICTS;
  // Full form only: take the hero's query once, then search on the user's behalf if it is complete.
  const prefilled = useRef(false);
  const autoRun = useRef(false);
  // The upazila <select> only gets its options once the district is in, so its value is applied a render later.
  const pendingUpazila = useRef("");
  useEffect(() => {
    if (compact || prefilled.current) return;
    prefilled.current = true;
    const p = new URLSearchParams(window.location.search);
    const district = p.get("district") ?? "";
    if (district) setDivision(divisionOf(district));
    for (const k of FIELDS) {
      const v = p.get(k);
      if (v) setValue(k, v);
    }
    pendingUpazila.current = p.get("upazila") ?? "";
    autoRun.current = FIELDS.every((k) => p.get(k));
  }, [compact, setValue]);
  useEffect(() => {
    if (!pendingUpazila.current || !district) return;
    setValue("upazila", pendingUpazila.current);
    pendingUpazila.current = "";
  }, [district, setValue]);

  const upazila = watch("upazila") as string;
  const mouzaNames = useMouzaSuggestions(district, upazila);
  const [mouzaOpen, setMouzaOpen] = useState(false);
  const [mouzaActive, setMouzaActive] = useState(-1);
  const mouzaValue = watch("mouza") as string;
  const mouzaField = register("mouza");
  const typed = fold(mouzaValue ?? "");
  const mouzaMatches = mouzaNames.filter((o) => !typed || fold(o.value).includes(typed)).slice(0, 50);
  const pickMouza = (value: string) => {
    setValue("mouza", value, { shouldValidate: true });
    setMouzaOpen(false);
    setMouzaActive(-1);
  };
  const onMouzaKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = mouzaMatches.length;
    if (e.key === "Escape") return setMouzaOpen(false);
    if (!n || (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter")) return;
    if (e.key === "Enter") {
      if (!mouzaOpen || mouzaActive < 0) return; // closed or nothing highlighted: Enter submits the form as usual
      e.preventDefault();
      return pickMouza(mouzaMatches[mouzaActive].value);
    }
    e.preventDefault();
    setMouzaOpen(true);
    setMouzaActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i <= 0 ? n : i) - 1));
  };
  const err = (k?: { message?: string }) => (k?.message ? t(`errors.${k.message}`) : undefined);

  const query = (v: VerifyValues) => new URLSearchParams({ district: v.district, upazila: v.upazila, mouza: v.mouza, khatian: v.khatian, dag: v.dag }).toString();
  const m = useMutation({
    mutationFn: (v: VerifyValues) => api.get<LandHit>(`/lands/search?${query(v)}`),
    onSuccess: (land) => router.push(`/verify/result?land_id=${encodeURIComponent(land.land_id)}`),
  });
  const pub = useMutation({
    mutationFn: (v: VerifyValues) => api.request<PublicLandSummary>(`/public/lands/search?${query(v)}`, { anonymous: true }),
  });
  const onValid = (v: VerifyValues) => {
    if (status === "authenticated") return m.mutate(v);
    if (compact) return router.push(`/verify?${query(v)}`); // the hero hands over; /verify shows the summary
    pub.reset();
    pub.mutate(v);
  };
  // U5.4: focus the first wrong field in screen order (district before mouza), so a screen reader starts at the top
  const formRef = useRef<HTMLFormElement>(null);
  const onInvalid = (errs: FieldErrors<VerifyInput>) => {
    const els = Array.from(formRef.current?.elements ?? []) as HTMLElement[];
    els.find((el) => (el as HTMLInputElement).name in errs)?.focus();
  };
  const submit = handleSubmit(onValid, onInvalid);

  useEffect(() => {
    if (!autoRun.current || status === "loading") return;
    autoRun.current = false;
    void submit();
  }, [status, submit]);

  // Bring the summary into view (on phones it lands below the fold).
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pub.data) summaryRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [pub.data]);

  const apiErr = (() => {
    const e = m.error ?? pub.error;
    if (!e) return null;
    if (e instanceof ApiError) {
      if (e.status === 404 || e.code === "LAND_NOT_FOUND") return "notFound";
      if (e.status === 429) return "rateLimited";
      if (e.status === 403) return "permission";
      if (e.code === "NETWORK_ERROR") return "network";
    }
    return "generic";
  })();

  const hint = compact ? undefined : t("numericHint");
  const form = (
      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        aria-label={compact ? t("title") : undefined}
        className={compact ? "grid grid-cols-2 items-start gap-3 lg:grid-cols-4" : "grid grid-cols-1 items-start gap-4 sm:grid-cols-2"}
      >
        {!compact && <p className="text-ink-muted sm:col-span-2">{t("intro")}</p>}
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
            aria-autocomplete={mouzaNames.length ? "list" : undefined}
            aria-activedescendant={mouzaOpen && mouzaActive >= 0 ? `mouza-opt-${mouzaActive}` : undefined}
            error={err(errors.mouza)}
            {...mouzaField}
            onChange={(e) => {
              mouzaField.onChange(e);
              setMouzaOpen(true);
              setMouzaActive(-1);
            }}
            onFocus={() => setMouzaOpen(true)}
            onBlur={(e) => {
              mouzaField.onBlur(e);
              setMouzaOpen(false);
            }}
            onKeyDown={onMouzaKey}
          />
          {mouzaOpen && mouzaMatches.length > 0 && (
            <ul
              id="mouza-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lift"
            >
              {mouzaMatches.map((o, i) => (
                <li
                  key={o.value}
                  id={`mouza-opt-${i}`}
                  role="option"
                  aria-selected={i === mouzaActive}
                  // mousedown (not click) so the input's blur doesn't close the list first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMouza(o.value);
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-ink hover:bg-primary/10 ${i === mouzaActive ? "bg-primary/15" : ""}`}
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
          size="lg"
          loading={m.isPending || pub.isPending}
          icon={<Search />}
          className={compact ? "col-span-full w-full lg:col-span-2 lg:mt-6" : "w-full sm:col-span-2"}
        >
          {m.isPending || pub.isPending ? t("searching") : t("submit")}
        </Button>
        {!compact && <p className="text-xs text-ink-muted sm:col-span-2">{t("demoNote")}</p>}
        {compact && status !== "authenticated" && (
          <p className="col-span-full text-sm text-ink-muted" data-testid="hero-land-note">
            {t("signInNote")}
          </p>
        )}
      </form>
  );

  if (compact) return form;
  return (
    <>
      <Card title={t("title")} icon={<SearchCheck />}>
        {form}
      </Card>
      {pub.data && (
        <div ref={summaryRef}>
          <PublicSummary data={pub.data} />
        </div>
      )}
    </>
  );
}
