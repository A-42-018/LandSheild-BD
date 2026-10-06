import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import { REVIEW_UP } from "@/features/auth/roles";
import MutationDetail from "@/features/mutation/MutationDetail";

export default function MutationDetailPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-4xl">
      <RequireRole roles={REVIEW_UP}>
        <MutationDetail id={id} />
      </RequireRole>
    </div>
  );
}
