"use client";

import { Canvas } from "@react-three/fiber";
import { motion, type MotionValue, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useTheme } from "next-themes";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { CircuitTracesWide } from "@/components/brand/circuit";
import { STAGE_CAMERA, scenePalette, type ScenePalette } from "./scene-kit";
import styles from "./landing.module.css";

export type StageStep = { number: string; title: string; body: string };
export type StageLabels = { rail: string; aria: string; steps: StageStep[] };
export type SceneRenderer = (progress: MotionValue<number>, reduced: boolean, palette: ScenePalette) => ReactNode;

type StageSectionProps = {
  id: string;
  labels: StageLabels;
  scroll: string;
  scene: SceneRenderer;
  /** Which side the copy sits on at desktop widths. */
  side?: "left" | "right";
  /** Scroll length of the pinned section, in svh. */
  height?: number;
};

/** Each step owns an equal slice of the scroll; one fades fully out before the next fades in. */
const FADE = 0.045;

/** 0 below `from`, 1 above `to`, linear between. */
function ramp(value: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

function Step({
  progress,
  step,
  index,
  total,
  reduced,
}: {
  progress: MotionValue<number>;
  step: StageStep;
  index: number;
  total: number;
  reduced: boolean;
}) {
  const first = index === 0;
  const last = index === total - 1;
  const start = index / total;
  const end = (index + 1) / total;
  // Computed, not interpolated across a keyframe range: a range whose leading
  // outputs repeat does not clamp past its last key, which left the opening
  // step fading back in under the others for the rest of the section.
  const cover = (v: number) => {
    const entering = first ? 1 : ramp(v, start, start + FADE);
    const leaving = last ? 1 : 1 - ramp(v, end - FADE, end);
    return Math.min(entering, leaving);
  };
  const opacity = useTransform(progress, (v) => cover(v));
  const y = useTransform(progress, (v) => {
    const entering = first ? 1 : ramp(v, start, start + FADE);
    const leaving = last ? 1 : 1 - ramp(v, end - FADE, end);
    return (1 - entering) * 12 - (1 - leaving) * 8;
  });
  const counter = `${step.number} / ${String(total).padStart(2, "0")}`;

  return (
    <motion.div
      style={{ opacity: reduced ? (last ? 1 : 0) : opacity, y: reduced ? 0 : y }}
      className="absolute inset-x-0 bottom-0"
      aria-hidden={reduced && !last}
    >
      <p className="font-mono text-[11px] text-primary-ink sm:text-xs">{counter}</p>
      <h3 className="mt-2 max-w-[22ch] font-display text-xl font-semibold leading-tight text-foreground sm:mt-3 sm:max-w-[18ch] sm:text-[1.7rem] lg:text-[2rem] lg:leading-[1.1]">
        {step.title}
      </h3>
      <p className="mt-2.5 max-w-[46ch] text-[15px] leading-6 text-muted-foreground sm:mt-4 sm:max-w-[38ch] sm:text-base sm:leading-7">{step.body}</p>
    </motion.div>
  );
}

/**
 * The pinned stage every 3D chapter shares: an instrument rail carrying the
 * scroll progress, the scene itself standing free on the section, and step
 * copy that crossfades as the scene advances. The board's trace ornament runs
 * in behind the object, so the scene reads as the end of the circuit.
 */
export function StageSection({ id, labels, scroll, scene, side = "left", height = 280 }: StageSectionProps) {
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const { resolvedTheme } = useTheme();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const inView = useInView(host, { margin: "30% 0px 30% 0px" });
  const line = useTransform(scrollYProgress, [0, 1], ["scaleX(0)", "scaleX(1)"]);
  const copyRight = side === "right";
  const palette = scenePalette(resolvedTheme === "dark");

  return (
    <section ref={section} id={id} className={styles.stage} style={{ "--stage-height": `${height}svh` } as CSSProperties}>
      <div className={styles.stageSticky}>
        <div
          ref={host}
          className={`grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_12rem] gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-6 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-8 lg:px-10 lg:py-8 ${
            copyRight ? "lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.3fr)]" : "lg:grid-cols-[minmax(15rem,0.3fr)_minmax(0,1fr)]"
          }`}
        >
          <div className="flex items-center gap-4 lg:col-span-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.rail}</span>
            <div className="relative h-px flex-1 bg-border-strong">
              <motion.div className="absolute inset-0 origin-left bg-primary" style={{ transform: reduced ? "scaleX(1)" : line }} />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{scroll}</span>
          </div>

          {/* The scene sits directly on the stage: no frame, no panel, so the
              animation itself is the object on the page. */}
          <div className={`relative order-2 min-h-0 ${copyRight ? "lg:order-1" : "lg:order-2"}`}>
            <CircuitTracesWide
              tone="quiet"
              className={`pointer-events-none absolute bottom-0 h-1/2 w-4/5 opacity-70 ${copyRight ? "right-0 -scale-x-100" : "left-0"}`}
            />
            <Canvas
              shadows="percentage"
              camera={STAGE_CAMERA}
              dpr={[1, 1.5]}
              frameloop={inView && !reduced ? "always" : "demand"}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            >
              {scene(scrollYProgress, reduced, palette)}
            </Canvas>
            <p className="sr-only">{labels.aria}</p>
          </div>

          <div className={`relative order-3 lg:min-h-[16rem] lg:self-center ${copyRight ? "lg:order-2" : "lg:order-1"}`}>
            {labels.steps.map((step, index) => (
              <Step key={step.number} progress={scrollYProgress} step={step} index={index} total={labels.steps.length} reduced={reduced} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
