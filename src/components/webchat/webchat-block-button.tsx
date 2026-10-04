"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Prohibit } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { setWebchatVisitorBlockedAction } from "@/app/actions/webchat";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { webchatErrorKey } from "@/lib/webchat/types";

export function WebchatBlockButton({
  entryId,
  blocked,
}: {
  entryId: string;
  blocked: boolean;
}) {
  const t = useTranslations("webchat");
  const { toast } = useToast();
  const [source, setSource] = useState({ entryId, blocked });
  const [current, setCurrent] = useState(blocked);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (source.entryId !== entryId || source.blocked !== blocked) {
    setSource({ entryId, blocked });
    setCurrent(blocked);
  }

  const apply = async (next: boolean) => {
    setBusy(true);
    const result = await setWebchatVisitorBlockedAction(entryId, next);
    setBusy(false);
    if ("error" in result) {
      const key = webchatErrorKey(result.code);
      toast({
        title: t("block.failed"),
        description: key ? t(key) : result.error,
        variant: "destructive",
      });
      return;
    }
    setCurrent(next);
    toast({ title: next ? t("block.blocked") : t("block.unblocked") });
  };

  const label = current ? t("block.unblock") : t("block.block");

  return (
    <>
      <TooltipWrapper content={current ? t("block.unblockHint") : t("block.blockHint")}>
        <button
          type="button"
          onClick={() => (current ? void apply(false) : setConfirmOpen(true))}
          disabled={busy}
          aria-label={label}
          aria-pressed={current}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-2xs font-semibold transition-colors disabled:opacity-50",
            current
              ? "bg-muted text-destructive-ink hover:bg-muted/80"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Prohibit weight={current ? "fill" : "regular"} className={cn("h-4 w-4", busy && "animate-pulse")} />
          <span className="hidden xl:inline">{label}</span>
        </button>
      </TooltipWrapper>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("block.confirmTitle")}
        description={t("block.confirmDescription")}
        confirmLabel={t("block.block")}
        cancelLabel={t("block.cancel")}
        onConfirm={() => apply(true)}
      />
    </>
  );
}
