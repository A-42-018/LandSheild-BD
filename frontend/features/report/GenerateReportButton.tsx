"use client";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import type { VerificationOut } from "./types";

export default function GenerateReportButton({ landId }: { landId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { api } = useAuth();
  const m = useMutation({
    mutationFn: () => api.post<VerificationOut>("/verification", { land_id: landId }),
    onSuccess: (v) => router.push(`/report/${encodeURIComponent(v.id)}`),
  });
  const err = m.error;
  return (
    <div className="flex flex-col items-start gap-2 print:hidden">
      <Button onClick={() => m.mutate()} loading={m.isPending} icon={<FileText />}>
        {m.isPending ? t("report.generating") : t("report.generate")}
      </Button>
      {m.isError && (
        <p role="alert" className="text-sm text-critical">
          {err instanceof ApiError && err.status === 403 ? t("errors.permission") : t("report.generateError")}
        </p>
      )}
    </div>
  );
}
