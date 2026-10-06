"use client";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui";
import UsersPanel from "./UsersPanel";
import { DocumentsPanel, LandRecordsPanel } from "./RecordsPanels";
import LedgerCard from "./LedgerCard";

export default function AdminView() {
  const t = useTranslations("admin.console");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
      <Tabs
        label={t("tabsLabel")}
        tabs={[
          { id: "users", label: t("tabs.users"), content: <UsersPanel /> },
          { id: "records", label: t("tabs.records"), content: <LandRecordsPanel /> },
          { id: "documents", label: t("tabs.documents"), content: <DocumentsPanel /> },
          { id: "ledger", label: t("tabs.ledger"), content: <LedgerCard /> },
        ]}
      />
    </div>
  );
}
