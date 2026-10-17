"use client";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { useWatchlist, useWatchToggle } from "./useMy";

/** "নজরে রাখুন" on the result page and in the search history (U3.2). Citizens only; renders nothing for staff. */
export default function WatchButton({ landId, size = "md" }: { landId: string; size?: "sm" | "md" }) {
  const t = useTranslations("my.watch");
  const toast = useToast();
  const { user } = useAuth();
  const citizen = user?.role === "CITIZEN";
  const list = useWatchlist(citizen);
  const m = useWatchToggle();
  if (!citizen) return null;

  const watched = Boolean(list.data?.items.some((i) => i.land_id === landId));
  const toggle = () =>
    m.mutate(
      { landId, watch: !watched },
      {
        onSuccess: (now) => toast("success", t(now ? "added" : "removed", { land: landId })),
        onError: (e) =>
          toast("error", e instanceof ApiError && e.code === "WATCHLIST_FULL" ? t("full", { limit: list.data?.limit ?? 20 }) : t("error")),
      },
    );

  return (
    <Button
      variant={watched ? "ghost" : "secondary"}
      size={size}
      loading={m.isPending}
      disabled={list.isPending}
      icon={watched ? <EyeOff /> : <Eye />}
      onClick={toggle}
    >
      {watched ? t("remove") : t("add")}
    </Button>
  );
}
