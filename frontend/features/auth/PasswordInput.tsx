"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui/Input";

/** Password field with a show/hide toggle. */
export default function PasswordInput(props: Omit<InputProps, "type" | "endAdornment">) {
  const t = useTranslations("authShell");
  const [shown, setShown] = useState(false);
  return (
    <Input
      {...props}
      type={shown ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          aria-pressed={shown}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {shown ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
        </button>
      }
    />
  );
}
