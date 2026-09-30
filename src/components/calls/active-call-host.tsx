"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { InCallPanel } from "@/components/calls/in-call-panel";
import { DockBounds } from "@/components/docks/dock-bounds";
import { useDraggableDock } from "@/components/docks/use-draggable-dock";
import { useCallSession } from "@/contexts/call-session-context";
import {
  setCallActive,
  subscribeCallRequest,
  useDialerOpen,
} from "@/lib/call-session/call-session-control";
import { cn } from "@/lib/utils";

export function ActiveCallHost() {
  const t = useTranslations("calling.widget");
  const tc = useTranslations("calling");
  const { x, y, boundsRef, startDrag, reset, dragProps } = useDraggableDock("active-call");
  const { callState, startCall } = useCallSession();
  const dialerOpen = useDialerOpen();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    return subscribeCallRequest(({ phoneNumber, whatsAppPhoneId, trunkId, label }) => {
      if (trunkId) {
        setActiveLabel(label ?? null);
        startCall(phoneNumber, { trunkId });
        return;
      }
      if (!whatsAppPhoneId) return;
      const clean = phoneNumber.replace(/[^\d+]/g, "");
      if (!clean) return;
      setActiveLabel(label ?? null);
      startCall(clean, { whatsAppPhoneId });
    });
  }, [startCall]);

  const hasActiveCall = callState != null && callState.status !== "ended";

  useEffect(() => {
    setCallActive(hasActiveCall);
    return () => setCallActive(false);
  }, [hasActiveCall]);

  if (!callState || dialerOpen) return null;

  const answered = callState.status === "answered";

  return (
    <>
      <DockBounds ref={boundsRef} />
      <motion.section
        aria-labelledby="active-call-title"
        {...dragProps}
        dragConstraints={boundsRef}
        style={{ x: x, y: y }}
        className="fixed bottom-4 right-4 z-[65] flex w-[min(300px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-lg"
      >
        <header
          onPointerDown={startDrag}
          onDoubleClick={(event) => {
            if (!(event.target as HTMLElement).closest("button")) reset();
          }}
          title={tc("dragHint")}
          className="flex cursor-grab touch-none select-none items-center gap-2.5 border-b border-border px-4 pb-2.5 pt-3 active:cursor-grabbing"
        >
          <span
            aria-hidden
            className={cn("h-2 w-2 flex-shrink-0 rotate-45 rounded-[1px]", answered ? "animate-dot-pulse bg-healthy" : "bg-primary")}
          />
          <h2 id="active-call-title" className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">
            {t("title")}
          </h2>
        </header>
        <InCallPanel via={activeLabel} />
      </motion.section>
    </>
  );
}
