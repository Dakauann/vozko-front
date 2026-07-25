"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  DotsSixVertical,
  Microphone,
  MicrophoneSlash,
  PhoneCall,
  PhoneDisconnect,
  SpinnerGap,
  User,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CallState } from "@/hooks/use-conversation-ws";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";


interface CrmCallWindowProps {
  callState: CallState;
  onEndCall: () => void;
  onToggleMute: (muted: boolean) => void;
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


const BAR_COUNT = 28;

function AudioLevelBars({
  localLevel,
  remoteLevel,
  isActive,
}: {
  localLevel: number;
  remoteLevel: number;
  isActive: boolean;
}) {
  const barsRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const noiseRef = useRef<number[]>(Array(BAR_COUNT).fill(0.5));
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0));
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const level = Math.max(localLevel, remoteLevel);
      frameRef.current++;

      if (frameRef.current % 3 === 0) {
        for (let i = 0; i < BAR_COUNT; i++) {
          noiseRef.current[i] = Math.random();
        }
      }

      const next = barsRef.current.map((prev, i) => {
        const noise = noiseRef.current[i];
        const center = BAR_COUNT / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const bell = 1 - distFromCenter * 0.6;

        const target = isActive
          ? Math.max(0.04, bell * noise * level * 1.8 + level * 0.15)
          : 0.03;

        const speed = target > prev ? 0.7 : 0.25;
        return prev + (target - prev) * speed;
      });

      barsRef.current = next;
      setBars([...next]);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [localLevel, remoteLevel, isActive]);

  return (
    <div className="flex items-end justify-center gap-px h-10">
      {bars.map((val, i) => (
        <div
          key={i}
          className="w-[2px] rounded-t-[1px] bg-blue-500/80"
          style={{ height: `${Math.max(2, val * 38)}px` }}
        />
      ))}
    </div>
  );
}


function RingingPulse() {
  return (
    <div className="relative flex items-center justify-center h-10">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/20"
          initial={{ width: 24, height: 24, opacity: 0.6 }}
          animate={{
            width: [24, 64],
            height: [24, 64],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
        />
      ))}
      <PhoneCall weight="fill" className="relative z-10 h-4 w-4 text-primary" />
    </div>
  );
}


export default function CrmCallWindow({
  callState,
  onEndCall,
  onToggleMute,
  translations: t,
}: CrmCallWindowProps) {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    return {
      x: window.innerWidth - 296 - 24,
      y: window.innerHeight - 320 - 24,
    };
  });
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callState.status !== "answered" || !callState.answeredAt) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callState.answeredAt!) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [callState.status, callState.answeredAt]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      onToggleMute(next);
      return next;
    });
  }, [onToggleMute]);


  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: Math.max(
        0,
        Math.min(window.innerWidth - 280, e.clientX - dragOffset.current.x),
      ),
      y: Math.max(
        0,
        Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y),
      ),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);


  const isRinging = callState.status === "ringing";
  const isAnswered = callState.status === "answered";
  const isEnded = callState.status === "ended";
  const isWaitingSlot = callState.status === "waiting_slot";

  const statusLabel = useMemo(() => {
    if (isWaitingSlot) return t.waitingSlot ?? "Aguardando linha disponível...";
    if (isRinging) return t.ringing ?? "Chamando...";
    if (isAnswered) return formatDuration(elapsed);
    if (isEnded) {
      switch (callState.endReason) {
        case "failed":
          return t.callFailed ?? "Chamada falhou";
        case "busy":
          return t.busy ?? "Ocupado";
        case "no_answer":
          return t.noAnswer ?? "Sem resposta";
        case "declined":
          return t.declined ?? "Recusada";
        default:
          return callState.durationSeconds != null
            ? `${t.callEnded ?? "Encerrada"} · ${formatDuration(callState.durationSeconds)}`
            : (t.callEnded ?? "Encerrada");
      }
    }
    return "";
  }, [
    isRinging,
    isWaitingSlot,
    isAnswered,
    isEnded,
    elapsed,
    callState.endReason,
    callState.durationSeconds,
    t,
  ]);

  const displayName =
    callState.leadName || callState.phoneNumber || callState.entryId;
  const displayNumber = callState.phoneNumber ?? callState.entryId;

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={windowRef}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
        className="fixed z-[9999]"
        style={{ left: position.x, top: position.y }}
      >
        <div
          className={cn(
            "w-[272px] rounded-2xl bg-card border border-border/60 overflow-hidden",
            "shadow-[0_12px_24px_-8px_rgba(15,23,42,0.22),0_8px_16px_-8px_rgba(15,23,42,0.12),inset_0_1px_0_var(--shadow-highlight)]",
          )}
        >
          {/* ── Drag Handle ──────────────────────────────────────── */}
          <div
            className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <DotsSixVertical
              weight="bold"
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          </div>

          {/* ── Content ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center px-6 pb-5">
            {/* Avatar */}
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full mb-3",
                isEnded
                  ? "bg-muted text-muted-foreground"
                  : isWaitingSlot
                    ? "bg-yellow-500 text-white"
                    : "bg-primary text-white",
              )}
            >
              <User weight="bold" className="h-5 w-5" />
            </div>

            {/* Name */}
            <p className="text-sm font-semibold text-foreground truncate max-w-full leading-tight">
              {isWaitingSlot
                ? (t.waitingSlot ?? "Aguardando linha...")
                : displayName}
            </p>

            {/* Number (if different from name) */}
            {displayNumber !== displayName && (
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {displayNumber}
              </p>
            )}

            {/* Status */}
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full flex-shrink-0",
                  (isRinging || isWaitingSlot) && "bg-amber-400 animate-pulse",
                  isAnswered && "bg-emerald-400",
                  isEnded && "bg-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  (isRinging || isWaitingSlot) && "text-amber-500",
                  isAnswered && "text-muted-foreground",
                  isEnded && "text-muted-foreground",
                )}
              >
                {statusLabel}
              </span>
            </div>

            {/* ── Visualizer area ────────────────────────────────── */}
            <div className="w-full mt-4 mb-1">
              {(isRinging || isWaitingSlot) && <RingingPulse />}
              {isAnswered && (
                <AudioLevelBars
                  localLevel={callState.localAudioLevel ?? 0}
                  remoteLevel={callState.remoteAudioLevel ?? 0}
                  isActive={!muted}
                />
              )}
              {isEnded && (
                <div className="flex items-center justify-center h-10">
                  <PhoneDisconnect
                    weight="fill"
                    className="h-5 w-5 text-muted-foreground"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Action bar ───────────────────────────────────────── */}
          {!isEnded ? (
            <div className="flex items-center justify-center gap-4 px-6 pb-5">
              {/* Mute */}
              <button
                onClick={handleToggleMute}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                  muted
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-muted text-muted-foreground hover:bg-border",
                )}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? (
                  <MicrophoneSlash
                    weight="fill"
                    className="h-[18px] w-[18px]"
                  />
                ) : (
                  <Microphone weight="fill" className="h-[18px] w-[18px]" />
                )}
              </button>

              {/* End call */}
              <button
                onClick={onEndCall}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all duration-200 active:scale-95 shadow-sm"
                title={t.endCall ?? "Encerrar chamada"}
              >
                <PhoneDisconnect weight="fill" className="h-5 w-5" />
              </button>

              {/* Spacer for balance */}
              <div className="h-10 w-10" />
            </div>
          ) : (
            <div className="px-6 pb-4">
              <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-muted-foreground/40 rounded-full"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 3, ease: "linear" }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
