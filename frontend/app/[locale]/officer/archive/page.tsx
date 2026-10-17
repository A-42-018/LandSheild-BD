import { setRequestLocale } from "next-intl/server";
import ArchiveSearch from "@/features/archive/ArchiveSearch";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("archive.title");

export default function ArchivePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ArchiveSearch />;
}
