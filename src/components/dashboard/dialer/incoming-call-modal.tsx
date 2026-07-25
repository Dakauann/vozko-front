"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DotsSixVertical, Phone, PhoneIncoming, PhoneSlash, WhatsappLogo } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { IncomingCallOffer } from "@/lib/dialer/inbound-call-types";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface IncomingCallModalProps {
  offer: IncomingCallOffer;
  accept: (offerId: string) => void;
  decline: (offerId: string, reason?: string) => void;
}

const WINDOW_WIDTH = 288;

function RingingPulse() {
  return (
    <div className="relative flex h-10 items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-emerald-500/25"
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
      <PhoneIncoming
        weight="fill"
        className="relative z-10 h-4 w-4 text-emerald-600"
      />
    </div>
  );
}

export function IncomingCallModal({
  offer,
  accept,
  decline,
}: IncomingCallModalProps) {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    return {
      x: window.innerWidth - WINDOW_WIDTH - 24,
      y: 24,
    };
  });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      isDragging.current = true;
      dragOffset.current = {
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [position],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: Math.max(
        0,
        Math.min(
          window.innerWidth - WINDOW_WIDTH,
          event.clientX - dragOffset.current.x,
        ),
      ),
      y: Math.max(
        0,
        Math.min(window.innerHeight - 80, event.clientY - dragOffset.current.y),
      ),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 440;
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
        g.gain.setValueAtTime(phase === 0 || phase === 2 ? 0.1 : 0, now);
        phase = (phase + 1) % 4;
      };
      tick();
      intervalRef.current = setInterval(tick, 500);
    } catch {
      // Visual ringing still works when the browser blocks AudioContext.
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
  }, [offer.offerId]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={offer.offerId}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
        className="fixed z-[9999]"
        style={{ left: position.x, top: position.y }}
      >
        <div
          className={cn(
            "w-[288px] overflow-hidden rounded-2xl border border-border/60 bg-card",
            "shadow-[0_12px_24px_-8px_rgba(15,23,42,0.22),0_8px_16px_-8px_rgba(15,23,42,0.12),inset_0_1px_0_var(--shadow-highlight)]",
          )}
        >
          <div
            className="flex cursor-grab select-none items-center justify-center py-1.5 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <DotsSixVertical
              weight="bold"
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          </div>

          <div className="flex flex-col items-center px-6 pb-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg">
              <PhoneIncoming weight="fill" className="h-5 w-5" />
            </div>

            <p className="max-w-full truncate text-sm font-semibold leading-tight text-foreground">
              Chamada recebida
            </p>
            {offer.channel === "whatsapp" ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                <WhatsappLogo weight="fill" className="h-3 w-3" />
                Via WhatsApp
              </span>
            ) : null}
            <p className="mt-0.5 max-w-full truncate font-mono text-xs text-muted-foreground">
              {offer.fromNumber || "Numero desconhecido"}
            </p>
            {offer.toNumber ? (
              <p className="mt-1 max-w-full truncate text-[11px] text-muted-foreground">
                Para {offer.toNumber}
              </p>
            ) : null}

            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">
                Tocando no discador
              </span>
            </div>

            <div className="mb-1 mt-4 w-full">
              <RingingPulse />
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 px-6 pb-5">
            <button
              type="button"
              onClick={() => decline(offer.offerId)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition-all duration-200 hover:bg-red-600 active:scale-95"
              title="Recusar"
              aria-label="Recusar chamada"
            >
              <PhoneSlash weight="fill" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => accept(offer.offerId)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm transition-all duration-200 hover:bg-emerald-600 active:scale-95"
              title="Atender"
              aria-label="Atender chamada"
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