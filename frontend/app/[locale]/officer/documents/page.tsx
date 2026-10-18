import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import LibraryView from "@/features/library/LibraryView";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("library.title");

export default function DocumentsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
