import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import LoginForm from "@/features/auth/LoginForm";
import { LoadingState } from "@/components/ui";

/** U6: plain centred form card with a small flat mark above (no logo card wrapper). */
export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
