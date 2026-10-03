import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";

export const RISK_TONE: Record<string, BadgeTone> = {
  LOW: "verified",
  MEDIUM: "review",
  HIGH: "critical",
};

const RISK_ICON: Record<string, JSX.Element> = {
  LOW: <CheckCircle2 />,
  MEDIUM: <AlertTriangle />,
  HIGH: <ShieldAlert />,
};

export default function RiskBadge({ level }: { level: string }) {
  const t = useTranslations("risk.level");
  const known = level in RISK_TONE;
  return (
    <Badge tone={RISK_TONE[level] ?? "pending"} icon={RISK_ICON[level]}>
      {known ? t(level) : level}
    </Badge>
  );
}
