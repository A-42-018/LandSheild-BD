import { setRequestLocale } from "next-intl/server";
import RequireRole from "@/features/auth/RequireRole";
import WhatYouNeed from "@/features/services/WhatYouNeed";
import CheckForm from "@/features/check/CheckForm";

export default function CheckPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-5xl p-3 sm:p-5">
      <div className="mb-4"><WhatYouNeed service="check" /></div>
      <RequireRole>
        <CheckForm />
      </RequireRole>
    </div>
  );
}
