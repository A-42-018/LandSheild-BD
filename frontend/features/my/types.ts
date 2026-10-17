/** Citizen area `/me/*` (U3.2). Mirrors backend/app/schemas/me.py. */
export interface ParcelBrief {
  land_id: string;
  district: string;
  upazila: string;
  mouza: string;
  khatian_no: string;
  dag_no: string;
  status: string;
}

export interface SearchItem extends ParcelBrief {
  search_count: number;
  last_searched_at: string;
  watched: boolean;
}

export interface SearchList {
  items: SearchItem[];
  total: number;
}

export interface WatchItem extends ParcelBrief {
  note: string | null;
  created_at: string;
  unread: number;
}

export interface WatchList {
  items: WatchItem[];
  limit: number;
}

export interface ReportItem {
  id: string;
  land_id: string;
  mouza: string;
  dag_no: string;
  status: string;
  risk_level: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ReportList {
  items: ReportItem[];
  total: number;
}

export type NotificationKind =
  | "WATCH_TRANSACTION"
  | "WATCH_MUTATION"
  | "WATCH_MUTATION_STATUS"
  | "WATCH_ENCUMBRANCE"
  | "REPORT_READY";

export interface NotificationItem {
  id: string;
  kind: NotificationKind | string;
  land_id: string | null;
  ref_id: string | null;
  data: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: NotificationItem[];
  total: number;
  unread: number;
}

export interface MeSummary {
  searches: number;
  watching: number;
  reports: number;
  unread: number;
  recent_searches: SearchItem[];
  recent_reports: ReportItem[];
  latest_notifications: NotificationItem[];
}

/** The citizen's linked NID: only the last four digits ever come back. */
export interface NidStatus {
  registered: boolean;
  last4: string | null;
  verified_at: string | null;
}

export interface MyLand extends ParcelBrief {
  area: number;
  area_unit: string;
  since: string | null;
  until: string | null;
}

export interface MyLands {
  nid: NidStatus;
  current: MyLand[];
  past: MyLand[];
  total_current: number;
  /** current holdings in decimal (shotangsho); null when a unit could not be converted */
  total_area_decimal: number | null;
}
