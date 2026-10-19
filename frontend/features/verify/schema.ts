import { z } from "zod";

import { normalizeDigits } from "@/lib/intl-locale";
import { SURVEYS } from "@/lib/surveys";

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

/** Optional digits (Bangla digits converted, leading zeros kept: the API ignores them). Empty string = not given. */
const jl = z.preprocess(
  (v) => (typeof v === "string" ? normalizeDigits(v).trim() : v),
  z.string().max(10, "tooLong").regex(/^\d*$/, "numeric").optional(),
);

const sheet = z.preprocess(
  (v) => (typeof v === "string" ? normalizeDigits(v).trim() : v),
  z.string().max(20, "tooLong").optional(),
);

/** Required, no default (D4): an empty select is "" and fails with `surveyRequired`. */
const survey = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(SURVEYS, { errorMap: () => ({ message: "surveyRequired" }) }),
);

export const verifySchema = z.object({
  district: text,
  upazila: text,
  mouza: text,
  survey,
  jl_no: jl,
  sheet_no: sheet,
  khatian: numeric,
  dag: numeric,
});

export type VerifyInput = z.input<typeof verifySchema>;
export type VerifyValues = z.output<typeof verifySchema>;
