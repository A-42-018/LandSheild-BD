/** Small static geo list (demo). `value` is the English name sent to the API; labels are display-only. */
export interface GeoOption {
  value: string;
  en: string;
  bn: string;
}
export interface District extends GeoOption {
  upazilas: GeoOption[];
}

const g = (en: string, bn: string): GeoOption => ({ value: en, en, bn });

export const DISTRICTS: District[] = [
  {
    ...g("Dhaka", "ঢাকা"),
    upazilas: [g("Savar", "সাভার"), g("Dhamrai", "ধামরাই"), g("Keraniganj", "কেরানীগঞ্জ"), g("Dohar", "দোহার"), g("Nawabganj", "নবাবগঞ্জ")],
  },
  {
    ...g("Gazipur", "গাজীপুর"),
    upazilas: [g("Sreepur", "শ্রীপুর"), g("Kaliakair", "কালিয়াকৈর"), g("Gazipur Sadar", "গাজীপুর সদর"), g("Kapasia", "কাপাসিয়া"), g("Kaliganj", "কালীগঞ্জ")],
  },
  {
    ...g("Narayanganj", "নারায়ণগঞ্জ"),
    upazilas: [g("Rupganj", "রূপগঞ্জ"), g("Sonargaon", "সোনারগাঁও"), g("Araihazar", "আড়াইহাজার"), g("Bandar", "বন্দর"), g("Narayanganj Sadar", "নারায়ণগঞ্জ সদর")],
  },
];

export const upazilasOf = (district: string): GeoOption[] =>
  DISTRICTS.find((d) => d.value === district)?.upazilas ?? [];

export const labelOf = (o: GeoOption, locale: string): string => (locale === "bn" ? o.bn : o.en);
