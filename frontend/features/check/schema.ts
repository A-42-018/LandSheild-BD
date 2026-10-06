import { z } from "zod";
import { verifySchema } from "@/features/verify/schema";

/** Same land fields as Verify + an optional seller name (error keys: `check.errors.*`). */
export const checkSchema = verifySchema.extend({
  seller: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(100, "tooLong").optional()),
});

export type CheckInput = z.input<typeof checkSchema>;
export type CheckValues = z.output<typeof checkSchema>;
