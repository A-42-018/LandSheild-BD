import { z } from "zod";

import { normalizeDigits } from "@/lib/intl-locale";

export { normalizeDigits };

/** Error messages are i18n keys under `verify.errors.*`. */
const numeric = z.preprocess(
  (v) => (typeof v === "string" ? normalizeDigits(v).trim() : v),
  z
    .string()
    .min(1, "required")
    .max(50, "tooLong")
    .regex(/^\d+([/-]\d+)?$/, "numeric"),
);

const text = z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1, "required").max(100, "tooLong"));

export const verifySchema = z.object({
  district: text,
  upazila: text,
  mouza: text,
  khatian: numeric,
  dag: numeric,
});

export type VerifyInput = z.input<typeof verifySchema>;
export type VerifyValues = z.output<typeof verifySchema>;
