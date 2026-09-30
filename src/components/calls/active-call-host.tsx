"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { DockBounds } from "@/components/docks/dock-bounds";
import { useDraggableDock } from "@/components/docks/use-draggable-dock";
import {
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  SpinnerGap,
} from "@/components/icons";

import {
  setCallActive,
  subscribeCallRequest,
  useDialerOpen,
} from "@/lib/call-session/call-session-control";
import { cn } from "@/lib/utils";
import { useCallSession } from "@/contexts/call-session-context";
import {
  formatCallDuration,
  useCallElapsedSeconds,
} from "@/hooks/use-call-clock";
import { formatPhoneForDisplay } from "@/lib/phone/display";

export function ActiveCallHost() {
  const t = useTranslations("calling.widget");
  const tc = useTranslations("calling");
  const { x, y, boundsRef, startDrag, reset, dragProps } =
    useDraggableDock("active-call");
  const { callState, startCall, endCall, muted, setMuted } = useCallSession();
  const dialerOpen = useDialerOpen();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const elapsed = useCallElapsedSeconds(callState);

  useEffect(() => {
    return subscribeCallRequest(
      ({ phoneNumber, whatsAppPhoneId, trunkId, label }) => {
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
      },
    );
  }, [startCall]);

  const hasActiveCall = callState != null && callState.status !== "ended";

  useEffect(() => {
    setCallActive(hasActiveCall);
    return () => setCallActive(false);
  }, [hasActiveCall]);

  if (!hasActiveCall || !callState || dialerOpen) return null;

  const connecting =
    callState.status === "ringing" || callState.status === "waiting_slot";

  return (
    <>
      <DockBounds ref={boundsRef} />
      <motion.div
        role="status"
        aria-live="polite"
        {...dragProps}
        dragConstraints={boundsRef}
        style={{ x: x, y: y }}
        onPointerDown={startDrag}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest("button")) reset();
        }}
        title={tc("dragHint")}
        className="fixed bottom-4 right-4 z-[65] flex cursor-grab touch-none select-none items-center gap-3 rounded-[--radius] border border-border bg-card px-3 py-2 shadow-2xl active:cursor-grabbing"
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            connecting ? "bg-muted-foreground" : "bg-healthy",
          )}
        />
        <span className="flex min-w-0 flex-col leading-none">
          <span className="legend leading-none">
            {t(
              callState.status === "waiting_slot"
                ? "waitingSlot"
                : connecting
                  ? "ringing"
                  : "inCall",
            )}
            {activeLabel ? ` · ${activeLabel}` : ""}
          </span>
          <span className="readout mt-1 truncate text-sm font-semibold leading-none text-foreground">
            {formatPhoneForDisplay(callState.phoneNumber)}
          </span>
        </span>
        {callState.status === "answered" ? (
          <span className="readout shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
            {formatCallDuration(elapsed)}
          </span>
        ) : null}
        {connecting ? (
          <SpinnerGap
            className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
        {callState.status === "answered" ? (
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-pressed={muted}
            aria-label={t(muted ? "unmute" : "mute")}
            title={t(muted ? "unmute" : "mute")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] border border-control-edge text-foreground transition-colors hover:bg-muted"
          >
            {muted ? (
              <MicrophoneSlash className="h-4 w-4" />
            ) : (
              <Microphone className="h-4 w-4" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            endCall();
            setActiveLabel(null);
          }}
          aria-label={t("endCall")}
          title={t("endCall")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] bg-destructive text-destructive-foreground transition-colors hover:opacity-90"
        >
          <PhoneDisconnect className="h-4 w-4" aria-hidden="true" />
        </button>
      </motion.div>
    </>
  );
}
