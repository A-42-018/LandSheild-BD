import type { Leaf, LhdrField } from "../types";

/** A leaf may be a Field object or (hand-written records) a bare value. */
export function asField<V>(x: Leaf<V>): LhdrField<V> | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "object" && !Array.isArray(x)) return x as LhdrField<V>;
  return { value: x as V };
}

export const hasValue = (x: Leaf): boolean => {
  const v = asField(x)?.value;
  return v !== null && v !== undefined && v !== "";
};
