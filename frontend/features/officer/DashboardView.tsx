"use client";
import { useTranslations } from "next-intl";
import OfficerPageHeader from "@/features/officer/OfficerPageHeader";
import PageTip from "@/components/PageTip";
import { useAuth } from "@/features/auth/AuthContext";
import Activity from "./Activity";
import Alerts from "./Alerts";
import Charts from "./Charts";
import KpiCards from "./KpiCards";
import QueueTable from "./QueueTable";

export default function DashboardView() {
  const t = useTranslations("officer");
  const { user } = useAuth();
  const titleKey = user?.role === "ADMIN" ? "titleAdmin" : user?.role === "REVIEWER" ? "titleReviewer" : "title";
  return (
    <div className="flex flex-col gap-6">
      <OfficerPageHeader root title={t(titleKey)} purpose={t("purpose")} />
      <PageTip page="officer" />
      <KpiCards />
      <Charts />
      <QueueTable />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Alerts />
        </div>
        <Activity />
      </div>
    </div>
  );
}
