import { redirect } from "@/i18n/navigation";

/** The admin console moved to /admin (U3.5); old bookmarks land there. */
export default function OldAdminPage({ params: { locale } }: { params: { locale: string } }) {
  redirect({ href: "/admin", locale });
}
