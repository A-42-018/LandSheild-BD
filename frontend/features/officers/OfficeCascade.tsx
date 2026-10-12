"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoadingState, Select } from "@/components/ui";
import { bi, officePath, type Office } from "./types";
import { useDistricts, useDivisions, useOfficeList, useUpazilas } from "./useOffices";

/** Division > Zila > Upozila > Land office pickers; every name is shown in English and Bangla. */
export default function OfficeCascade({
  officeId,
  onChange,
  error,
}: {
  officeId: string;
  onChange: (office: Office | null) => void;
  error?: string;
}) {
  const t = useTranslations("officerSignup");
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [upazila, setUpazila] = useState("");

  const divisions = useDivisions();
  const districts = useDistricts(division);
  const upazilas = useUpazilas(division, district);
  const offices = useOfficeList(division, district, upazila, !!district);
  const options = (p?: { en: string; bn: string }[]) => (Array.isArray(p) ? p : []).map((x) => ({ value: x.en, label: bi(x.en, x.bn) }));
  const items = Array.isArray(offices.data?.items) ? offices.data.items : [];
  const chosen = items.find((o) => o.id === officeId) ?? null;

  const pick = (setter: (v: string) => void, ...reset: ((v: string) => void)[]) => (v: string) => {
    setter(v);
    reset.forEach((r) => r(""));
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Select
        label={t("division")}
        required
        value={division}
        placeholder={t("selectDivision")}
        options={options(divisions.data)}
        onChange={(e) => pick(setDivision, setDistrict, setUpazila)(e.target.value)}
      />
      <Select
        label={t("district")}
        required
        value={district}
        disabled={!division}
        placeholder={t("selectDistrict")}
        options={options(districts.data)}
        onChange={(e) => pick(setDistrict, setUpazila)(e.target.value)}
      />
      <Select
        label={t("upazila")}
        value={upazila}
        disabled={!district}
        placeholder={t("districtLevel")}
        hint={t("upazilaHint")}
        options={options(upazilas.data)}
        onChange={(e) => pick(setUpazila)(e.target.value)}
      />
      {district && offices.isLoading ? (
        <LoadingState />
      ) : (
        <Select
          label={t("office")}
          required
          value={officeId}
          disabled={!district}
          placeholder={t("selectOffice")}
          error={error}
          options={items.map((o) => ({ value: o.id, label: bi(o.name_en, o.name_bn) }))}
          onChange={(e) => onChange(items.find((o) => o.id === e.target.value) ?? null)}
        />
      )}
      {chosen && (
        <p className="text-sm text-ink-muted" data-testid="office-path">
          {officePath(chosen)}
          {chosen.location ? ` · ${chosen.location}` : ""}
        </p>
      )}
    </div>
  );
}
