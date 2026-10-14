"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import PageHeader, { type Crumb } from "@/components/PageHeader";
import { useAuth } from "@/features/auth/AuthContext";

/** Officer-area page header: "Officer" breadcrumb (unless this is the dashboard) and the signed-in officer's office as meta. */
export default function OfficerPageHeader({
  title,
  purpose,
  crumbs,
  meta = [],
  root = false,
}: {
  title: ReactNode;
  purpose?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode[];
  root?: boolean;
}) {
  const te = useTranslations("errors");
  const locale = useLocale();
  const { user } = useAuth();
  const office = user?.office ? (locale === "bn" ? user.office.name_bn : user.office.name_en) : null;
  return (
    <PageHeader
      title={title}
      purpose={purpose}
      crumbs={crumbs ?? (root ? [] : [{ label: te("officerCrumb"), href: "/officer" }])}
      meta={[...meta, office]}
    />
  );
}
