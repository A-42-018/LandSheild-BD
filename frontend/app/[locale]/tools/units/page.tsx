import { setRequestLocale } from "next-intl/server";
import UnitConverter from "@/features/tools/UnitConverter";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("tools.units.title");

// Public tool: no sign-in, no personal data, nothing is sent to the server.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="tools">
      <UnitConverter />
    </ClientMessages>
  );
}
