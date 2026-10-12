"use client";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui";
import PageHeader from "@/components/PageHeader";
import UsersPanel from "./UsersPanel";
import OfficerRequestsPanel from "./OfficerRequestsPanel";
import { DocumentsPanel, LandRecordsPanel } from "./RecordsPanels";
import LedgerCard from "./LedgerCard";

export default function AdminView() {
  const t = useTranslations("admin.console");
  const tn = useTranslations("errors");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} purpose={t("purpose")} crumbs={[{ label: tn("officerCrumb"), href: "/officer" }]} />
      <Tabs
        label={t("tabsLabel")}
        tabs={[
          { id: "users", label: t("tabs.users"), content: <UsersPanel /> },
          { id: "officers", label: t("tabs.officers"), content: <OfficerRequestsPanel /> },
          { id: "records", label: t("tabs.records"), content: <LandRecordsPanel /> },
          { id: "documents", label: t("tabs.documents"), content: <DocumentsPanel /> },
          { id: "ledger", label: t("tabs.ledger"), content: <LedgerCard /> },
        ]}
      />
    </div>
  );
}
