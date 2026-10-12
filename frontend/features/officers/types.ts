export interface Place {
  en: string;
  bn: string;
}

export interface Office {
  id: string;
  code: string;
  office_type: string;
  division_en: string;
  division_bn: string;
  district_en: string;
  district_bn: string;
  upazila_en: string | null;
  upazila_bn: string | null;
  union_en: string | null;
  union_bn: string | null;
  name_en: string;
  name_bn: string;
  location: string | null;
}

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface OfficerRequestDraft {
  name: string;
  email: string;
  password: string;
  preferred_language: "en" | "bn";
  office_id: string;
  designation: string;
  phone: string;
  employee_id: string;
  proof_note?: string;
}

export interface AdminOfficerRequest {
  id: string;
  status: RequestStatus;
  created_at: string;
  user_id: string;
  name: string;
  email: string;
  designation: string;
  phone: string;
  employee_id: string;
  proof_note: string | null;
  office: Office;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface AdminOfficerRequestList {
  items: AdminOfficerRequest[];
  total: number;
  pending: number;
  limit: number;
  offset: number;
}

/** Every place and office name is shown in both languages, English first. */
export const bi = (en: string | null | undefined, bn: string | null | undefined): string =>
  en && bn && en !== bn ? `${en} / ${bn}` : (en ?? bn ?? "");

export const OFFICE_TYPES = [
  "District Land Office",
  "Upazila Land Office",
  "Union Land Office",
  "Circle Land Office (Metropolitan)",
] as const;

/** Division > Zila > Upozila > Union path of an office, both languages. */
export function officePath(o: Office): string {
  return [bi(o.division_en, o.division_bn), bi(o.district_en, o.district_bn)]
    .concat(o.upazila_en ? [bi(o.upazila_en, o.upazila_bn)] : [])
    .join(" › ");
}
