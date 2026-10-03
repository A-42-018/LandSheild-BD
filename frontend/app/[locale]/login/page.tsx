import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import LoginForm from "@/features/auth/LoginForm";
import { LoadingState } from "@/components/ui";

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-brand-gradient-soft p-4 sm:p-6">
      <div className="mb-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" width={820} height={608} className="h-24 w-auto drop-shadow-lg" />
      </div>
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
