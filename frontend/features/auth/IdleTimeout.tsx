"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthContext";

const ACTIVITY = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/** Signs an officer out after `idleMinutes` without activity; warns `warnSeconds` before, with a live countdown. */
export default function IdleTimeout({ idleMinutes = 15, warnSeconds = 120 }: { idleMinutes?: number; warnSeconds?: number }) {
  const t = useTranslations("auth.idle");
  const { logout } = useAuth();
  const router = useRouter();
  const idleMs = idleMinutes * 60_000;
  const last = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(null); // seconds until sign-out while the warning is open

  const stay = useCallback(() => {
    last.current = Date.now();
    setLeft(null);
  }, []);

  useEffect(() => {
    const touch = () => {
      if (left === null) last.current = Date.now(); // while warned, only the buttons count as "still here"
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => ACTIVITY.forEach((e) => window.removeEventListener(e, touch));
  }, [left]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const remaining = Math.ceil((last.current + idleMs - Date.now()) / 1000);
      if (remaining <= 0) {
        window.clearInterval(id);
        setLeft(null);
        logout().finally(() => router.replace("/login?expired=1"));
      } else setLeft(remaining <= warnSeconds ? remaining : null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [idleMs, warnSeconds, logout, router]);

  const mm = left === null ? "" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <Modal
      open={left !== null}
      onClose={stay}
      title={t("title")}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => { void logout().finally(() => router.replace("/login")); }}>{t("signOut")}</Button>
          <Button onClick={stay}>{t("stay")}</Button>
        </div>
      }
    >
      <p role="timer" aria-live="off" data-testid="idle-countdown" className="text-ink">
        {t("body", { time: mm })}
      </p>
      <p className="mt-2 text-sm text-ink-muted">{t("why")}</p>
    </Modal>
  );
}
