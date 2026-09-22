"use client";

import { CaretRight, Check } from "@/components/icons";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";


const COMMIT_AT = 0.9;

const HOLD_MS = 200;

const THUMB = 32;
const INSET = 4;

const ARRIVE = [0.1, 0.9, 0.2, 1] as const;
const DEPART = [0.9, 0.1, 1, 0.2] as const;

type Phase = "inert" | "armed" | "committing";

export function SlideToUnlock({
  armed,
  onUnlock,
  label,
  armedLabel,
  unlockedLabel,
  className,
}: {
  armed: boolean;
  onUnlock: () => void;
  label: string;
  armedLabel: string;
  unlockedLabel: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [travel, setTravel] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [phase, setPhase] = useState<Phase>("inert");
  const [announced, setAnnounced] = useState(0);
  const reduced = useReducedMotion();

  const fill = useTransform(x, (v) => v + THUMB + INSET * 2);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setTrackWidth(w);
      setTravel(Math.max(0, w - THUMB - INSET * 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (armed) {
      setPhase((p) => (p === "inert" ? "armed" : p));
      return;
    }
    setPhase("inert");
    setAnnounced(0);
    x.set(0);
  }, [armed, x]);

  const commit = useCallback(() => {
    if (travel <= 0) return;
    setPhase("committing");
    setAnnounced(100);
    const handOff = () => window.setTimeout(onUnlock, reduced ? 0 : HOLD_MS);
    if (reduced) {
      x.set(travel);
      handOff();
      return;
    }
    animate(x, travel, { duration: 0.15, ease: [...ARRIVE], onComplete: handOff });
  }, [travel, onUnlock, reduced, x]);

  const release = useCallback(() => {
    if (phase !== "armed") return;
    if (x.get() >= travel * COMMIT_AT) {
      commit();
      return;
    }
    setAnnounced(0);
    if (reduced) {
      x.set(0);
      return;
    }
    animate(x, 0, { duration: 0.15, ease: [...DEPART] });
  }, [phase, x, travel, commit, reduced]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (phase !== "armed") return;
      if (["ArrowRight", "End", "Enter", " ", "Spacebar"].includes(e.key)) {
        e.preventDefault();
        commit();
      }
    },
    [phase, commit],
  );

  const interactive = phase === "armed";
  const committing = phase === "committing";
  const text =
    phase === "inert" ? label : committing ? unlockedLabel : armedLabel;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={interactive ? 0 : -1}
      aria-label={armedLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={announced}
      aria-valuetext={text}
      aria-disabled={phase === "inert"}
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-10 w-full select-none overflow-hidden rounded-[--radius] border border-border bg-muted",
        interactive && "cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {
}
      {phase !== "inert" && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: fill }}
          aria-hidden
        />
      )}

      {}
      <span
        className="legend pointer-events-none absolute inset-0 flex items-center justify-center !text-muted-foreground"
        aria-hidden
      >
        {text}
      </span>

      {
}
      {phase !== "inert" && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: fill }}
          aria-hidden
        >
          <span
            className="legend flex h-full items-center justify-center !text-primary-foreground"
            style={{ width: trackWidth || undefined }}
          >
            {text}
          </span>
        </motion.span>
      )}

      {
}
      {phase !== "inert" && (
        <motion.div
          drag={interactive ? "x" : false}
          dragConstraints={{ left: 0, right: travel }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={release}
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduced ? 0 : 0.15, ease: [...ARRIVE] }}
          style={{ x, left: INSET, top: INSET }}
          className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary-ink shadow-quiet"
        >
          {committing ? (
            <Check className="h-4 w-4" weight="bold" />
          ) : (
            <CaretRight className="h-4 w-4" weight="bold" />
          )}
        </motion.div>
      )}
    </div>
  );
}
