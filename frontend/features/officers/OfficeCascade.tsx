"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
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
  const hintId = useId();
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [upazila, setUpazila] = useState("");

  const divisions = useDivisions();
  const districts = useDistricts(division);
  const upazilas = useUpazilas(division, district);
  const offices = useOfficeList(division, district, upazila, !!district);
  const options = (p?: { en: string; bn: string }[]) => (Array.isArray(p) ? p : []).map((x) => ({ value: x.en, label: bi(x.en, x.bn) }));
  const items = Array.isArray(offices.data?.items) ? offices.data.items : [];
  const wait = (q: { isLoading: boolean }, ready: string) => (q.isLoading ? t("loadingList") : ready);
  const failed = (q: { isError: boolean }) => (q.isError ? t("loadError") : undefined);
  const chosen = items.find((o) => o.id === officeId) ?? null;

  const pick = (setter: (v: string) => void, ...reset: ((v: string) => void)[]) => (v: string) => {
    setter(v);
    reset.forEach((r) => r(""));
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Container query: one row of four when the form is wide, a 2 x 2 block in the narrow form cards, one column on phones. */}
      <div className="[container-type:inline-size]">
        <div className="grid grid-cols-1 items-start gap-3 [@container(min-width:30rem)]:grid-cols-2 [@container(min-width:56rem)]:grid-cols-4">
          <Select
            label={t("division")}
            required
            value={division}
            disabled={divisions.isLoading}
            placeholder={wait(divisions, t("selectDivision"))}
            error={failed(divisions)}
            options={options(divisions.data)}
            onChange={(e) => pick(setDivision, setDistrict, setUpazila)(e.target.value)}
          />
          <Select
            label={t("district")}
            required
            value={district}
            disabled={!division || districts.isLoading}
            placeholder={wait(districts, t("selectDistrict"))}
            error={failed(districts)}
            options={options(districts.data)}
            onChange={(e) => pick(setDistrict, setUpazila)(e.target.value)}
          />
          <Select
            label={t("upazila")}
            value={upazila}
            disabled={!district || upazilas.isLoading}
            placeholder={wait(upazilas, t("districtLevel"))}
            aria-describedby={hintId}
            error={failed(upazilas)}
            options={options(upazilas.data)}
            onChange={(e) => pick(setUpazila)(e.target.value)}
          />
          <Select
            label={t("office")}
            required
            value={officeId}
            disabled={!district || offices.isLoading}
            placeholder={wait(offices, t("selectOffice"))}
            error={error ?? failed(offices)}
            options={items.map((o) => ({ value: o.id, label: bi(o.name_en, o.name_bn) }))}
            onChange={(e) => onChange(items.find((o) => o.id === e.target.value) ?? null)}
          />
        </div>
      </div>
      <p id={hintId} className="text-xs text-ink-muted">{t("upazilaHint")}</p>
      {chosen && (
        <p className="text-sm text-ink-muted" data-testid="office-path">
          {officePath(chosen)}
          {chosen.location ? ` · ${chosen.location}` : ""}
        </p>
      )}
    </div>
  );
}
