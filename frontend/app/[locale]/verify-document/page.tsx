import { setRequestLocale } from "next-intl/server";
import WhatYouNeed from "@/features/services/WhatYouNeed";
import VerifyDocumentView from "@/features/verify-document/VerifyDocumentView";

// Public (no login): the copy is compared and discarded, never stored.
export default function VerifyDocumentPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-xl p-3 sm:p-5">
      <div className="mb-4"><WhatYouNeed service="verifyDoc" /></div>
      <VerifyDocumentView />
    </div>
  );
}
