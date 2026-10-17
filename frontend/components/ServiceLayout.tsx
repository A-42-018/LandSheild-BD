import type { ReactNode } from "react";
import PageHeader, { type Crumb } from "@/components/PageHeader";
import PageTip, { type PageTipId } from "@/components/PageTip";
import WhatYouNeed from "@/features/services/WhatYouNeed";
import type { ServiceId } from "@/features/services/services";

/** Template A (service page): hero band, then the form (7/12) beside a sticky "What you need" card (5/12) from 1024 px.
 *  Below 1024 px "What you need" becomes a collapsible block above the form. `tip` adds the "এই পাতায় কী করবেন?" tip under the header (U4.2). */
export default function ServiceLayout({
  service, title, purpose, art, crumbs, meta, tip, children,
}: {
  service: ServiceId;
  title: ReactNode;
  purpose?: ReactNode;
  art?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode[];
  tip?: PageTipId;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={title} purpose={purpose} art={art} crumbs={crumbs} meta={meta} />
      {tip && <PageTip page={tip} />}
      <div className="grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1 lg:col-span-7">{children}</div>
        <div className="order-1 lg:sticky lg:top-24 lg:order-2 lg:col-span-5">
          <WhatYouNeed service={service} />
        </div>
      </div>
    </div>
  );
}
