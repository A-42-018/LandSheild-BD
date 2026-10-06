import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";

// Neutral backend status codes → tone. Text always comes from i18n `status.<CODE>`.
export const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "verified",
  COMPLETED: "verified",
  APPROVED: "verified",
  RECORDED: "verified",
  REVIEW_REQUIRED: "review",
  UNDER_REVIEW: "review",
  FLAGGED: "review",
  OPEN: "review",
  ESCALATED: "critical",
  FAILED: "critical",
  REJECTED: "critical",
  PENDING: "pending",
  APPLIED: "pending",
  HEARING: "review",
  UPLOADED: "pending",
  PROCESSING: "pending",
  EXTRACTED: "pending",
  DISMISSED: "pending",
};

const TONE_ICON: Record<BadgeTone, JSX.Element> = {
  verified: <CheckCircle2 />,
  review: <AlertTriangle />,
  critical: <XCircle />,
  pending: <Clock />,
};

export default function StatusBadge({ code }: { code: string }) {
  const t = useTranslations("status");
  const known = code in STATUS_TONE;
  const tone = STATUS_TONE[code] ?? "pending";
  return (
    <Badge tone={tone} icon={TONE_ICON[tone]}>
      {known ? t(code) : code}
    </Badge>
  );
}
