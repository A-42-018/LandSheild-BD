"use client";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { bi } from "./types";
import { useDistricts, useDivisions, useUpazilas } from "./useOffices";

export interface Area {
  division: string;
  district: string;
  upazila: string;
}
export const NO_AREA: Area = { division: "", district: "", upazila: "" };

/** Sort the record databases by area: Division > Zila > Upozila (each optional, bilingual). */
export default function AreaFilter({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  const t = useTranslations("officerSignup");
  const ta = useTranslations("area");
  const divisions = useDivisions();
  const districts = useDistricts(value.division);
  const upazilas = useUpazilas(value.division, value.district);
  const opts = (p?: { en: string; bn: string }[]) => (Array.isArray(p) ? p : []).map((x) => ({ value: x.en, label: bi(x.en, x.bn) }));
  return (
    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="area-filter">
      <legend className="sr-only">{ta("legend")}</legend>
      <Select label={t("division")} value={value.division} placeholder={ta("all")} options={opts(divisions.data)}
        onChange={(e) => onChange({ division: e.target.value, district: "", upazila: "" })} />
      <Select label={t("district")} value={value.district} placeholder={ta("all")} disabled={!value.division} options={opts(districts.data)}
        onChange={(e) => onChange({ ...value, district: e.target.value, upazila: "" })} />
      <Select label={t("upazila")} value={value.upazila} placeholder={ta("all")} disabled={!value.district} options={opts(upazilas.data)}
        onChange={(e) => onChange({ ...value, upazila: e.target.value })} />
    </fieldset>
  );
}

export function areaParams(s: URLSearchParams, a: Area) {
  if (a.division) s.set("division", a.division);
  if (a.district) s.set("district", a.district);
  if (a.upazila) s.set("upazila", a.upazila);
}
