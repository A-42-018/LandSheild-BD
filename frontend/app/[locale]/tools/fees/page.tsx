import { setRequestLocale } from "next-intl/server";
import FeeCalculator from "@/features/tools/FeeCalculator";
import ClientMessages from "@/components/ClientMessages";

// Public tool: no sign-in, no personal data, nothing is sent to the server.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="tools">
      <FeeCalculator />
    </ClientMessages>
  );
}
