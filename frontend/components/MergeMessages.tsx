"use client";
import { useMemo, type ReactNode } from "react";
import { NextIntlClientProvider, useLocale, useMessages, useNow, useTimeZone, type AbstractIntlMessages } from "next-intl";
import { mergeMessages } from "@/i18n/client-messages";

/** A nested provider replaces its parent's messages, so merge here instead of sending the shell's messages twice. */
export default function MergeMessages({ messages, children }: { messages: AbstractIntlMessages; children: ReactNode }) {
  const outer = useMessages();
  const merged = useMemo(() => mergeMessages(outer, messages), [outer, messages]);
  return (
    <NextIntlClientProvider locale={useLocale()} timeZone={useTimeZone()} now={useNow()} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
