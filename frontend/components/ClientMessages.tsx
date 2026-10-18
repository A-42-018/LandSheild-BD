import type { ReactNode } from "react";
import { getMessages } from "next-intl/server";
import { MESSAGE_SCOPES, pickMessages, type MessageScope } from "@/i18n/client-messages";
import MergeMessages from "./MergeMessages";

/** Sends one scope of i18n/client-messages.ts to the client components below it, on top of what the layout above sends.
 *  Wrap the whole tree a layout or page returns: tests/client-messages.test.ts treats the file as inside the scope. */
export default async function ClientMessages({ scope, children }: { scope: MessageScope; children: ReactNode }) {
  const messages = await getMessages();
  return <MergeMessages messages={pickMessages(messages, MESSAGE_SCOPES[scope])}>{children}</MergeMessages>;
}
