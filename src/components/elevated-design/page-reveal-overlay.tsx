"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import Image from "next/image";
import { getBrand } from "@/config/brand";

function createDeterministicRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

interface PageRevealOverlayProps {
  duration?: number;
  delay?: number;
  disableOnReducedMotion?: boolean;
}

interface StarTrail {
  id: string;
  direction: "left" | "right";
  duration: number;
  delay: number;
  top: number;
  width: number;
  rotate: number;
}

function PanelGradient({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  const gradientDirection = isLeft ? "bg-gradient-to-r" : "bg-gradient-to-l";

  return (
    <div
      className={`relative h-full w-full ${gradientDirection} from-card to-background`}
    ></div>
  );
}

const SESSION_KEY = "vozko:page-reveal-done";

export default function PageRevealOverlay({
  duration = 1.05,
  delay = 0.12,
  disableOnReducedMotion = true,
}: PageRevealOverlayProps) {
  // Only play the brand curtain once per browser session. Replaying on every
  // full reload of the locale layout was a common report of "screen goes solid
  // white/dark then recovers" (and could stick if timers were throttled).
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const brand = getBrand();
  const starTrails = useMemo<StarTrail[]>(() => {
    const STAR_COUNT_PER_SIDE = 8;
    const randomLeft = createDeterministicRandom(97);
    const randomRight = createDeterministicRandom(211);

    const buildTrail = (
      index: number,
      direction: "left" | "right",
      random: () => number,
    ): StarTrail => {
      const travelDuration = 0.95 + random() * 0.45;
      const travelDelay = delay + 0.18 + index * 0.04 + random() * 0.18;
      const topPosition = 18 + random() * 64;
      const trailLength = 110 + random() * 90;
      const baseTilt = direction === "left" ? -10 : 10;
      const tiltOffset = random() * 8 * (direction === "left" ? 1 : -1);

      return {
        id: `${direction}-${index}`,
        direction,
        duration: travelDuration,
        delay: travelDelay,
        top: topPosition,
        width: trailLength,
        rotate: baseTilt + tiltOffset,
      };
    };

    const leftTrails = Array.from({ length: STAR_COUNT_PER_SIDE }, (_, idx) =>
      buildTrail(idx, "left", randomLeft),
    );

    const rightTrails = Array.from({ length: STAR_COUNT_PER_SIDE }, (_, idx) =>
      buildTrail(idx, "right", randomRight),
    );

    return [...leftTrails, ...rightTrails];
  }, [delay]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!visible) return;

    const dismiss = () => {
      setVisible(false);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* private mode */
      }
    };

    const prefersReducedMotion =
      disableOnReducedMotion &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      const id = requestAnimationFrame(dismiss);
      return () => cancelAnimationFrame(id);
    }

    const totalDuration = (duration + delay) * 1000 + 650;
    const timer = setTimeout(dismiss, totalDuration);
    // Hard failsafe: never leave the curtain up more than 4s even if tab was
    // backgrounded and timers were clamped.
    const hard = setTimeout(dismiss, 4000);

    return () => {
      clearTimeout(timer);
      clearTimeout(hard);
    };
  }, [duration, delay, disableOnReducedMotion, visible]);

  if (!visible) return null;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-transparent "
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="absolute left-0 top-0 h-full w-full sm:w-1/2"
            initial={{ x: "0%" }}
            animate={{ x: "-102%" }}
            transition={{ duration, ease: [0.76, 0, 0.24, 1], delay }}
          >
            <PanelGradient side="left" />
          </motion.div>

          <motion.div
            className="absolute right-0 top-0 h-full w-full sm:w-1/2"
            initial={{ x: "0%" }}
            animate={{ x: "102%" }}
            transition={{
              duration,
              ease: [0.76, 0, 0.24, 1],
              delay: delay + 0.08,
            }}
          >
            <PanelGradient side="right" />
          </motion.div>

          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <motion.div
              className="relative flex h-40 w-40 items-center justify-center"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: [1, 1, 0.92], opacity: [1, 1, 0] }}
              exit={{ scale: 0.84, opacity: 0 }}
              transition={{
                duration: 1.2,
                ease: [0.65, 0, 0.35, 1],
                delay: delay + 0.04,
                times: [0, 0.65, 1],
              }}
            >
              <motion.div
                className="relative flex h-24 w-24 items-center justify-center rounded-full bg-card p-6 shadow-[0_30px_90px_-35px_rgba(100,116,139,0.5)] backdrop-blur-xl"
                initial={{ scale: 1, rotate: 0, opacity: 1 }}
                animate={{
                  scale: [1, 1, 0.94],
                  rotate: [0, 0, 8],
                  opacity: [1, 1, 0],
                }}
                exit={{ scale: 0.6, rotate: 20, opacity: 0 }}
                transition={{
                  duration: 1,
                  ease: [0.22, 1, 0.36, 1],
                  delay: delay + 0.1,
                  times: [0, 0.7, 1],
                }}
              >
                <motion.div
                  className="relative flex items-center justify-center"
                  initial={{ rotate: 0, scale: 1, opacity: 1 }}
                  animate={{
                    rotate: [0, 0, 6],
                    scale: [1, 1, 0.94],
                    opacity: [1, 1, 0],
                  }}
                  exit={{ rotate: 12, scale: 0.82, opacity: 0 }}
                  transition={{
                    duration: 1,
                    ease: [0.33, 1, 0.68, 1],
                    delay: delay + 0.16,
                    times: [0, 0.7, 1],
                  }}
                >
                  <Image
                    src={brand.logo.mark}
                    alt={brand.name}
                    width={140}
                    height={52}
                    className="pointer-events-none h-auto w-[120px] object-contain dark:hidden"
                    priority
                  />
                  <Image
                    src={brand.logo.markWhite}
                    alt={brand.name}
                    width={140}
                    height={52}
                    className="pointer-events-none hidden h-auto w-[120px] object-contain dark:block"
                    priority
                  />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          <div className="absolute inset-0 z-10">
            {starTrails.map((star) => (
              <motion.span
                key={star.id}
                className="pointer-events-none absolute block h-px bg-gradient-to-r from-slate-400/25 via-slate-500/70 to-slate-400/0 shadow-[0_0_16px_rgba(100,116,139,0.12)]"
                style={{
                  top: `${star.top}%`,
                  width: `${star.width}px`,
                }}
                initial={{ left: "-18%", opacity: 0, rotate: star.rotate }}
                animate={{
                  left: "118%",
                  opacity: [0, 0.8, 0],
                  rotate: star.rotate,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: star.duration,
                  ease: [0.5, 0, 0.3, 1],
                  delay: star.delay,
                  times: [0, 0.25, 1],
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
