import { setRequestLocale } from "next-intl/server";
import UnitConverter from "@/features/tools/UnitConverter";

// Public tool: no sign-in, no personal data, nothing is sent to the server.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <UnitConverter />;
}
