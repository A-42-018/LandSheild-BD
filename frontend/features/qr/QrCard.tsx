"use client";
import { useLocale, useTranslations } from "next-intl";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui";
import { publicUrl } from "./publicUrl";
import { usePublicSeal } from "./usePublicVerify";

function useSealUrl(landId: string) {
  const locale = useLocale();
  const seal = usePublicSeal(landId).data;
  return publicUrl(locale, landId, undefined, seal ? { deedId: seal.deed_id, hash12: seal.hash12 } : null);
}

/** Bare signed-QR image (report letterhead). Same URL as QrCard. */
export function SealQr({ landId, size = 88 }: { landId: string; size?: number }) {
  const t = useTranslations("qr");
  return <QRCodeSVG value={useSealUrl(landId)} size={size} level="M" role="img" aria-label={t("alt", { landId })} />;
}

export default function QrCard({ landId }: { landId: string }) {
  const t = useTranslations("qr");
  const url = useSealUrl(landId);
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
