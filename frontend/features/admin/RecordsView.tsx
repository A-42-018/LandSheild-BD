"use client";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui";
import { DocumentsPanel, LandRecordsPanel } from "./RecordsPanels";

/** Land records and uploaded documents, read-only lists (was two tabs of the old /officer/admin page). */
export default function RecordsView() {
  const t = useTranslations("admin.console");
  return (
    <Tabs
      variant="segmented"
      label={t("tabsLabel")}
      tabs={[
        { id: "records", label: t("tabs.records"), content: <LandRecordsPanel /> },
        { id: "documents", label: t("tabs.documents"), content: <DocumentsPanel /> },
      ]}
    />
  );
}
