"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { CallTransferPanel } from "@/components/calls/call-transfer-panel";
import { DockBounds } from "@/components/docks/dock-bounds";
import { useDraggableDock } from "@/components/docks/use-draggable-dock";
import {
  ArrowsLeftRight,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  SpinnerGap,
} from "@/components/icons";

import {
  requestTransferPanel,
  setCallActive,
  subscribeCallRequest,
  useDialerOpen,
} from "@/lib/call-session/call-session-control";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { transferErrorCode } from "@/lib/call-session/transfer";
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
  const tt = useTranslations("calling.transfer");
  const { callState, startCall, endCall, muted, setMuted, transfer, lastErrorCode, clearError } = useCallSession();
  const hasDialer = useSettledPermission("sip_trunks", "call");
  const [transferOpen, setTransferOpen] = useState(false);
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
  const answered = callState.status === "answered";
  const showTransfer = answered && !hasDialer && (transferOpen || transfer?.status === "ringing");
  const transferError = answered ? transferErrorCode(lastErrorCode) : null;
  const notice =
    transferError
      ? tt(`errors.${transferError}`)
      : answered && transfer?.status === "returned"
        ? tt(`returned.${transfer.reason === "declined" || transfer.reason === "cancelled" ? transfer.reason : "no_answer"}`)
        : null;

  const openTransfer = () => {
    clearError();
    if (hasDialer) {
      requestTransferPanel();
      return;
    }
    setTransferOpen((open) => !open);
  };

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
            {transfer?.status === "ringing"
              ? tt("holding")
              : t(
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
        {answered ? (
          <button
            type="button"
            onClick={openTransfer}
            aria-expanded={hasDialer ? undefined : showTransfer}
            aria-label={tt("open")}
            title={tt("open")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] border border-control-edge text-foreground transition-colors hover:bg-muted"
          >
            <ArrowsLeftRight className="h-4 w-4" />
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
        {showTransfer ? (
          <div
            className="absolute bottom-full right-0 mb-2 w-[min(300px,calc(100vw-2rem))] cursor-default overflow-hidden rounded-2xl border border-border-strong bg-card shadow-lg"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <CallTransferPanel onClose={() => setTransferOpen(false)} />
          </div>
        ) : null}
        {notice && !showTransfer ? (
          <p role="alert" className="absolute bottom-full right-0 mb-2 w-[min(300px,calc(100vw-2rem))] rounded-[--radius] border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
            {notice}
          </p>
        ) : null}
      </motion.div>
    </>
  );
}
