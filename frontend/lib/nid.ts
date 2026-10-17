import { normalizeDigits } from "@/lib/intl-locale";

/** Same rule as the backend (core/nid.py): 10, 13 or 17 digits; Bangla digits, spaces and dashes are fine. */
export const cleanNid = (v: string) => normalizeDigits(v).replace(/[\s-]/g, "");
export const validNid = (v: string) => /^\d+$/.test(v) && [10, 13, 17].includes(v.length);
