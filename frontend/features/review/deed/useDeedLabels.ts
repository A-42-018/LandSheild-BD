import { useTranslations } from "next-intl";

/** Display text for coded values (roles, deed kinds, calendars...): the label when there is one, else the code. */
export function useEnumText(group: string) {
  const t = useTranslations("review.deed");
  return (v: unknown): string => {
    const s = String(v);
    return t.has(`${group}.${s}`) ? t(`${group}.${s}`) : s;
  };
}

export function useYesNo() {
  const t = useTranslations("review.deed");
  return (v: unknown): string => (v === true ? t("yes") : v === false ? t("no") : String(v));
}
