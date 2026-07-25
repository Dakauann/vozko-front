"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall, PhoneDisconnect, SpinnerGap } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { CallState } from "@/hooks/use-conversation-ws";
import { cn } from "@/lib/utils";

interface CrmCallOverlayProps {
  callState: CallState;
  onEndCall: () => void;
  translations: {
    ringing?: string;
    inCall?: string;
    callEnded?: string;
    callFailed?: string;
    busy?: string;
    noAnswer?: string;
    declined?: string;
    waitingSlot?: string;
    endCall?: string;
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CrmCallOverlay({
  callState,
  onEndCall,
  translations: t,
}: CrmCallOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callState.status !== "answered" || !callState.answeredAt) {
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callState.answeredAt!) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [callState.status, callState.answeredAt]);

  const isRinging = callState.status === "ringing";
  const isAnswered = callState.status === "answered";
  const isEnded = callState.status === "ended";
  const isWaitingSlot = callState.status === "waiting_slot";

  const endReasonLabel = (() => {
    switch (callState.endReason) {
      case "failed":
        return t.callFailed ?? "Call failed";
      case "busy":
        return t.busy ?? "Busy";
      case "no_answer":
        return t.noAnswer ?? "No answer";
      case "declined":
        return t.declined ?? "Declined";
      default:
        return t.callEnded ?? "Call ended";
    }
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex items-center gap-3 border-b px-4 py-2.5 flex-shrink-0",
          isRinging && "bg-amber-500 border-amber-600",
          isAnswered && "bg-emerald-500 border-emerald-600",
          isEnded && "bg-muted border-border",
          isWaitingSlot && "bg-yellow-500 border-yellow-600",
        )}
      >
        {/* Status icon */}
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
            isRinging && "bg-amber-500 text-white",
            isAnswered && "bg-emerald-500 text-white",
            isEnded && "bg-border text-muted-foreground",
            isWaitingSlot && "bg-yellow-500 text-white",
          )}
        >
          {isRinging || isWaitingSlot ? (
            <SpinnerGap weight="bold" className="h-4 w-4 animate-spin" />
          ) : isAnswered ? (
            <PhoneCall weight="fill" className="h-4 w-4" />
          ) : (
            <PhoneDisconnect weight="fill" className="h-4 w-4" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-semibold",
              isRinging && "text-amber-700",
              isAnswered && "text-emerald-700",
              isEnded && "text-muted-foreground",
              isWaitingSlot && "text-yellow-700",
            )}
          >
            {isRinging && (t.ringing ?? "Ringing...")}
            {isAnswered && (t.inCall ?? "In call")}
            {isWaitingSlot &&
              (t.waitingSlot ?? "Waiting for available line...")}
            {isEnded && endReasonLabel}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {callState.phoneNumber ?? callState.entryId}
            {isAnswered && ` · ${formatDuration(elapsed)}`}
            {isEnded &&
              callState.durationSeconds != null &&
              ` · ${formatDuration(callState.durationSeconds)}`}
          </p>
        </div>

        {/* End call button */}
        {!isEnded && (
          <button
            onClick={onEndCall}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex-shrink-0 shadow-sm"
            title={t.endCall ?? "End call"}
          >
            <PhoneDisconnect weight="fill" className="h-4 w-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
