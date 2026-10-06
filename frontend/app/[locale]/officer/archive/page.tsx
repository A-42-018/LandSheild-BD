import { setRequestLocale } from "next-intl/server";
import ArchiveSearch from "@/features/archive/ArchiveSearch";

export default function ArchivePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ArchiveSearch />;
}
