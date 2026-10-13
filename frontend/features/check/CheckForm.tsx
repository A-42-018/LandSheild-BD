"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListChecks, Search } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { DISTRICTS, DIVISIONS, districtsOf, divisionOf, labelOf, upazilasOf } from "@/lib/geo";
import { useAuth } from "@/features/auth/AuthContext";
import { checkSchema, type CheckInput, type CheckValues } from "./schema";
import CheckResult from "./CheckResult";
import type { PrePurchaseDto } from "./types";

export default function CheckForm() {
  const t = useTranslations("check");
  const tv = useTranslations("verify");
  const locale = useLocale();
  const { api } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckInput, unknown, CheckValues>({
    resolver: zodResolver(checkSchema),
    defaultValues: { district: "", upazila: "", mouza: "", khatian: "", dag: "", seller: "" },
  });

  const district = watch("district") as string;
  // Division is a UI-only filter: picking one narrows the districts; picking a district fills it in.
  const [division, setDivision] = useState("");
  const districtOptions = division ? districtsOf(division) : DISTRICTS;
  const err = (k?: { message?: string }) => (k?.message ? t(`errors.${k.message}`) : undefined);

  const m = useMutation<PrePurchaseDto, ApiError, CheckValues>({
    mutationFn: async (v) => {
      const q = new URLSearchParams({ district: v.district, upazila: v.upazila, mouza: v.mouza, khatian: v.khatian, dag: v.dag });
      const land = await api.get<{ land_id: string }>(`/lands/search?${q.toString()}`);
      const s = v.seller ? `?seller=${encodeURIComponent(v.seller)}` : "";
      return api.get<PrePurchaseDto>(`/lands/${encodeURIComponent(land.land_id)}/pre-purchase-check${s}`);
    },
  });

  const apiErr = (() => {
    const e = m.error;
    if (!e) return null;
    if (e.status === 404 || e.code === "LAND_NOT_FOUND") return "notFound";
    if (e.status === 403) return "permission";
    if (e.code === "NETWORK_ERROR") return "network";
    return "generic";
  })();

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("title")} icon={<ListChecks />} accent="primary">
        <form onSubmit={handleSubmit((v) => m.mutate(v))} noValidate className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          <p className="text-ink-muted md:col-span-3">{t("intro")}</p>
          <Select
            label={tv("division")}
            placeholder={tv("selectDivision")}
            options={DIVISIONS.map((d) => ({ value: d.value, label: labelOf(d, locale) }))}
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setValue("district", "");
              setValue("upazila", "");
            }}
          />
          <Select
            label={tv("district")}
            required
            placeholder={tv("selectDistrict")}
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
            label={tv("upazila")}
            required
            disabled={!district}
            placeholder={tv("selectUpazila")}
            options={upazilasOf(district).map((u) => ({ value: u.value, label: labelOf(u, locale) }))}
            error={err(errors.upazila)}
            {...register("upazila")}
          />
          <Input label={tv("mouza")} required autoComplete="off" error={err(errors.mouza)} {...register("mouza")} />
          <div className="contents">
            <Input label={tv("khatian")} required inputMode="numeric" autoComplete="off" hint={tv("numericHint")} error={err(errors.khatian)} {...register("khatian")} />
            <Input label={tv("dag")} required inputMode="numeric" autoComplete="off" hint={tv("numericHint")} error={err(errors.dag)} {...register("dag")} />
          </div>
          <div className="md:col-span-3"><Input label={t("seller")} autoComplete="off" hint={t("sellerHint")} error={err(errors.seller)} {...register("seller")} /></div>
          {apiErr && (
            <p role="alert" className="text-sm text-critical md:col-span-3">
              {t(`errors.${apiErr}`)}
            </p>
          )}
          <Button type="submit" loading={m.isPending} icon={<Search />} className="w-full md:col-span-3">
            {m.isPending ? t("checking") : t("submit")}
          </Button>
          <p className="text-xs text-ink-muted md:col-span-3">{tv("demoNote")}</p>
        </form>
      </Card>
      <div aria-live="polite">{m.data && <CheckResult data={m.data} />}</div>
    </div>
  );
}
