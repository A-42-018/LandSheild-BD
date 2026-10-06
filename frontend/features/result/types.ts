export interface Person {
  name: string;
  father_name?: string | null;
}
export interface DocRef {
  id: string;
  type: string;
}
export interface LandInfo {
  land_id: string;
  district: string;
  upazila: string;
  mouza: string;
  khatian_no: string;
  dag_no: string;
  area: number;
  area_unit: string;
  status: string;
  current_owners: Person[];
}
export interface OwnershipEntry {
  owner: Person;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  confidence: number | null;
  document: DocRef | null;
}
export interface TransactionEntry {
  transaction_type: string;
  transaction_date: string | null;
  seller: Person;
  buyer: Person;
  area: number;
  area_unit: string;
  status: string;
  document: DocRef | null;
}
export interface MutationEntry {
  mutation_no: string;
  status: string;
  applied_at: string;
  decided_at?: string | null;
  previous_khatian_no?: string | null;
  new_khatian_no?: string | null;
  applicant?: Person | null;
  area?: number | null;
  area_unit?: string | null;
  ac_land_office?: string | null;
  deed_no?: string | null;
}
export interface EncumbranceEntry {
  type: string;
  status: string;
  started_at: string | null;
  resolved_at: string | null;
  reference_no?: string | null;
  authority?: string | null;
  note?: string | null;
}
