"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowsLeftRight,
  DotsSixVertical,
  Phone,
  PhoneSlash,
  User,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { IncomingTransferOffer } from "@/lib/dialer/transfer-types";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface IncomingTransferModalProps {
  offer: IncomingTransferOffer;
  initiatorName: string;
  accept: (transferId: string) => void;
  decline: (transferId: string, reason?: string) => void;
}

const WINDOW_WIDTH = 288;


function RingingPulse() {
  return (
    <div className="relative flex items-center justify-center h-10">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/25"
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
      <ArrowsLeftRight
        weight="fill"
        className="relative z-10 h-4 w-4 text-primary"
      />
    </div>
  );
}

export function IncomingTransferModal({
  offer,
  initiatorName,
  accept,
  decline,
}: IncomingTransferModalProps) {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    return {
      x: window.innerWidth - WINDOW_WIDTH - 24,
      y: 24,
    };
  });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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
        Math.min(
          window.innerWidth - WINDOW_WIDTH,
          e.clientX - dragOffset.current.x,
        ),
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

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 480;
      osc.connect(gain);
      osc.start();
      ctxRef.current = ctx;
      gainRef.current = gain;
      oscRef.current = osc;

      let phase = 0;
      const tick = () => {
        const g = gainRef.current;
        const c = ctxRef.current;
        if (!g || !c) return;
        const now = c.currentTime;
        g.gain.cancelScheduledValues(now);
        if (phase === 0 || phase === 2) {
          g.gain.setValueAtTime(0.1, now);
        } else {
          g.gain.setValueAtTime(0, now);
        }
        phase = (phase + 1) % 4;
      };
      tick();
      intervalRef.current = setInterval(tick, 500);
    } catch {
      // No audio, visual pulse only.
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        oscRef.current?.stop();
      } catch {
        /* already stopped */
      }
      oscRef.current?.disconnect();
      gainRef.current?.disconnect();
      void ctxRef.current?.close();
      oscRef.current = null;
      gainRef.current = null;
      ctxRef.current = null;
    };
  }, [offer.transferId]);

  if (typeof window === "undefined") return null;

  const kindLabel = offer.recall
    ? "Retorno de transferência"
    : offer.kind === "attended"
      ? "Transferência atendida"
      : "Transferência cega";
  const statusLabel = offer.recall
    ? "Chamada retornando para você"
    : "Transferindo para você";

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={offer.transferId}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
        className="fixed z-[9999]"
        style={{ left: position.x, top: position.y }}
      >
        <div
          className={cn(
            "w-[288px] rounded-2xl bg-card border border-border/60 overflow-hidden",
            "shadow-[0_12px_24px_-8px_rgba(15,23,42,0.22),0_8px_16px_-8px_rgba(15,23,42,0.12),inset_0_1px_0_var(--shadow-highlight)]",
          )}
        >
          {/* ── Drag handle ────────────────────────────────── */}
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

          {/* ── Content ───────────────────────────────────── */}
          <div className="flex flex-col items-center px-6 pb-5">
            {/* Avatar (solid gradient + white icon, per design rule) */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full mb-3 bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">
              <User weight="fill" className="h-5 w-5" />
            </div>

            {/* Initiator name */}
            <p className="text-sm font-semibold text-foreground truncate max-w-full leading-tight">
              {initiatorName}
            </p>

            {/* Customer number */}
            {offer.phoneNumber ? (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {offer.phoneNumber}
              </p>
            ) : null}

            {/* Status row */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-amber-400 animate-pulse" />
              <span className="text-xs font-medium text-amber-500">
                {statusLabel}
              </span>
            </div>

            {/* Visualizer */}
            <div className="w-full mt-4 mb-1">
              <RingingPulse />
            </div>

            {/* Kind label */}
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
              {kindLabel}
            </p>

            {/* Optional note */}
            {offer.note ? (
              <p className="mt-3 w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground line-clamp-3">
                “{offer.note}”
              </p>
            ) : null}
          </div>

          {/* ── Action bar (mirrors CrmCallWindow layout) ─── */}
          <div className="flex items-center justify-center gap-4 px-6 pb-5">
            <button
              type="button"
              onClick={() => decline(offer.transferId)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all duration-200 active:scale-95 shadow-sm"
              title="Recusar"
              aria-label="Recusar transferência"
            >
              <PhoneSlash weight="fill" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => accept(offer.transferId)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all duration-200 active:scale-95 shadow-sm"
              title="Aceitar"
              aria-label="Aceitar transferência"
            >
              <Phone weight="fill" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
