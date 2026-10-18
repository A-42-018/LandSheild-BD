import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import LoginForm from "@/features/auth/LoginForm";
import { LoadingState } from "@/components/ui";
import { pageTitle } from "@/lib/page-title";
import ClientMessages from "@/components/ClientMessages";

export const generateMetadata = pageTitle("auth.loginTitle");

/** Sign in: glass auth card (AuthShell) over the landing topographic backdrop. */
export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <ClientMessages scope="login">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:pt-2">
        <Suspense fallback={<LoadingState />}>
          <LoginForm />
        </Suspense>
      </div>
    </ClientMessages>
  );
}
