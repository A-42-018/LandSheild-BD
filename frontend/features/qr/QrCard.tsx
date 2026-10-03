"use client";
import { useLocale, useTranslations } from "next-intl";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui";
import { publicUrl } from "./publicUrl";

export default function QrCard({ landId }: { landId: string }) {
  const t = useTranslations("qr");
  const locale = useLocale();
  const url = publicUrl(locale, landId);
  return (
    <Card title={t("title")} icon={<QrCode />} data-testid="qr-card" className="break-inside-avoid">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="rounded-lg border border-line bg-white p-3">
          <QRCodeSVG
            value={url}
            size={128}
            level="M"
            role="img"
            aria-label={t("alt", { landId })}
            data-testid="qr-code"
          />
        </div>
        <div className="min-w-0 text-sm text-ink">
          <p>{t("caption")}</p>
          <p className="mt-2 text-xs text-ink-muted">{t("urlLabel")}</p>
          <a href={url} data-testid="qr-url" className="break-all text-primary underline">
            {url}
          </a>
        </div>
      </div>
    </Card>
  );
}
