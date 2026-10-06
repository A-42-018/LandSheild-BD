import { setRequestLocale } from "next-intl/server";
import ToolsHub from "@/features/tools/ToolsHub";

// Public tool: no sign-in, no personal data, nothing is sent to the server.
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ToolsHub />;
}
