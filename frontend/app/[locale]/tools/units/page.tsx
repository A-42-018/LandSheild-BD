import { setRequestLocale } from "next-intl/server";
import UnitConverter from "@/features/tools/UnitConverter";
import ClientMessages from "@/components/ClientMessages";

// Public tool: no sign-in, no personal data, nothing is sent to the server.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="tools">
      <UnitConverter />
    </ClientMessages>
  );
}
