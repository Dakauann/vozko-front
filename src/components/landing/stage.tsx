"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { motion, useMotionValue, useReducedMotion, useTransform, useInView, type MotionValue } from "framer-motion";
import { useTheme } from "next-themes";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play } from "@/components/icons";
import { CircuitTracesWide } from "@/components/brand/circuit";
import { STAGE_CAMERA, scenePalette, type ScenePalette } from "./scene-kit";
import styles from "./landing.module.css";

export type StageStep = { number: string; title: string; body: string };
export type StageLabels = {
  /** Short mono tag over the chapter title. */
  rail: string;
  /** The chapter's own headline: the largest type in the section. */
  title: string;
  /** One sentence under the headline, before the animation starts talking. */
  lede: string;
  aria: string;
  steps: StageStep[];
};
export type StageControlLabels = { play: string; pause: string; steps: string; step: string };
export type SceneRenderer = (progress: MotionValue<number>, reduced: boolean, palette: ScenePalette) => ReactNode;

type StageSectionProps = {
  id: string;
  labels: StageLabels;
  controls: StageControlLabels;
  scene: SceneRenderer;
  /** Which side the copy sits on at desktop widths. */
  side?: "left" | "right";
  overview?: ReactNode;
};

/**
 * A step is a move and then a pause, not one long slide. The move runs at the
 * speed the thing would really move — a card crosses a column in about a
 * second — and the reading time is spent standing still afterwards, so a
 * scene never plays in slow motion just because its copy is long.
 */
const ACTION_SECONDS = 2.1;
/** A move can never eat more than this share of its step. */
const ACTION_SHARE = 0.45;

/**
 * How long a step holds, derived from its own copy rather than guessed.
 * Brysbaert's 2019 meta-analysis (190 studies, 18,573 participants) puts
 * silent reading of English non-fiction at a mean of 238 wpm; 250 with a short
 * orienting beat lands close to that once the move at the head of the step is
 * counted too. Every step in a section runs at the pace of its longest one,
 * because the scenes divide their timeline into equal slices.
 */
const WORDS_PER_MINUTE = 250;
const ORIENT_SECONDS = 0.6;
/** Nothing flashes past, and nothing outstays a reader who is already done. */
const STEP_BOUNDS = [4.2, 7] as const;
/** The end state is the payoff; it holds before the loop starts over. */
const HOLD_SECONDS = 1.4;
/** The scene dips out rather than snapping, so the restart reads as a replay. */
const FADE_OUT_SECONDS = 0.45;
const FADE_IN_SECONDS = 0.5;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stepSeconds(steps: StageStep[]) {
  const longest = Math.max(...steps.map(step => countWords(step.title) + countWords(step.body)));
  const reading = ORIENT_SECONDS + (longest / WORDS_PER_MINUTE) * 60;
  return Math.min(STEP_BOUNDS[1], Math.max(STEP_BOUNDS[0], reading));
}

const subscribeVisibility = (callback: () => void) => {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
};
const isPageVisible = () => !document.hidden;
const serverVisible = () => true;

/** Html mounts separate React roots; give reduced-motion scenes time to settle. */
function SettleScene() {
  const sceneState = useThree();
  useEffect(() => {
    Object.assign(sceneState.gl.domElement, { __landingScene: sceneState });
  }, [sceneState]);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const interval = window.setInterval(invalidate, 80);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 800);
    return () => { window.clearInterval(interval); window.clearTimeout(timeout); };
  }, [invalidate]);
  return null;
}

type Loop = {
  progress: MotionValue<number>;
  /** Scene opacity: dips at the wrap so the reset is never seen unwinding. */
  fade: MotionValue<number>;
  index: number;
  playing: boolean;
  toggle: () => void;
  jump: (step: number) => void;
};

/**
 * The chapter plays itself: a step moves, a step waits, the next step moves.
 * One cycle walks the scene through its steps, holds on the finished state,
 * dips out and starts again. It only advances while the section is on screen
 * and the tab is in front, and it restarts from the first step whenever it
 * comes back into view, so a reader always meets the story at its beginning.
 */
function useStageLoop(steps: StageStep[], active: boolean, reduced: boolean): Loop {
  const progress = useMotionValue(reduced ? 1 : 0);
  const fade = useMotionValue(1);
  const [index, setIndex] = useState(reduced ? steps.length - 1 : 0);
  const [playing, setPlaying] = useState(true);
  const clock = useRef(0);
  const entered = useRef(false);
  const total = steps.length;
  const block = stepSeconds(steps);
  const action = Math.min(ACTION_SECONDS, block * ACTION_SHARE);
  const run = block * total;
  const cycle = run + HOLD_SECONDS + FADE_OUT_SECONDS;

  const apply = useCallback((elapsed: number) => {
    // Progress advances only over the move at the head of each step; the rest
    // of the step stands still on what just happened, so the reading time
    // never stretches the motion.
    const step = Math.min(total - 1, Math.floor(elapsed / block));
    const moved = Math.min(1, Math.max(0, (elapsed - step * block) / action));
    progress.set(elapsed >= run ? 1 : (step + moved) / total);
    fade.set(elapsed > run + HOLD_SECONDS
      ? Math.max(0, 1 - (elapsed - run - HOLD_SECONDS) / FADE_OUT_SECONDS)
      : Math.min(1, elapsed / FADE_IN_SECONDS));
    setIndex(step);
  }, [action, block, fade, progress, run, total]);

  useEffect(() => {
    if (reduced || !active) { entered.current = false; return; }
    // Coming back into view rewinds: nobody should arrive at step 04.
    if (!entered.current) { entered.current = true; clock.current = 0; }
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      // The opening frame only paints; a tab restored after minutes away must
      // not fast-forward the story on the frame it comes back.
      if (last) clock.current = (clock.current + Math.min(0.05, (now - last) / 1000)) % cycle;
      last = now;
      apply(clock.current);
      // Paused, the chapter still paints once so a jump between steps lands.
      if (playing) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, apply, cycle, playing, reduced]);

  const jump = useCallback((step: number) => {
    clock.current = step * block;
    apply(clock.current);
  }, [apply, block]);

  const toggle = useCallback(() => setPlaying(value => !value), []);

  return { progress, fade, index, playing, toggle, jump };
}

/** One segment of the chapter's progress bar, filling across its own step. */
function Tick({ progress, index, total, reduced }: { progress: MotionValue<number>; index: number; total: number; reduced: boolean }) {
  const scaleX = useTransform(progress, value => Math.min(1, Math.max(0, value * total - index)));
  return (
    <span className={styles.stageTickTrack}>
      <motion.span className={styles.stageTickFill} style={{ scaleX: reduced ? 1 : scaleX }} />
    </span>
  );
}

/**
 * The stage every 3D chapter shares: a headline that says plainly what the
 * chapter is, a progress bar that runs the loop and can be steered, the scene
 * standing free on the section, and step copy that crossfades under it. The
 * board's trace ornament runs in behind the object, so the scene reads as the
 * end of the circuit.
 */
export function StageSection({ id, labels, controls, scene, side = "left", overview }: StageSectionProps) {
  const t = useTranslations("landing");
  const host = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const pageVisible = useSyncExternalStore(subscribeVisibility, isPageVisible, serverVisible);
  const { resolvedTheme } = useTheme();
  // Mounted early so the canvas is warm before it is read; played only once the
  // section is genuinely on screen.
  const mounted = useInView(host, { margin: "40% 0px 40% 0px" });
  const onScreen = useInView(host, { amount: 0.3 });
  const active = onScreen && pageVisible;
  const loop = useStageLoop(labels.steps, active, reduced);
  const copyRight = side === "right";
  const palette = scenePalette(resolvedTheme === "dark");
  const total = labels.steps.length;

  return (
    <section id={id} className={styles.stage} data-side={side}>
      <div className={styles.stageInner}>
        <header>
          <p className={styles.stageEyebrow}>{labels.rail}</p>
          <h2 className={styles.stageTitle}>{labels.title}</h2>
        </header>

        <div className={styles.stageRail}>
          <div className={styles.stageTicks} role="group" aria-label={controls.steps}>
            {labels.steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                aria-current={index === loop.index || undefined}
                aria-label={`${controls.step} ${step.number}: ${step.title}`}
                className={styles.stageTick}
                data-active={index === loop.index || undefined}
                onClick={() => loop.jump(index)}
              >
                <Tick progress={loop.progress} index={index} total={total} reduced={reduced} />
              </button>
            ))}
          </div>
          {!reduced && (
            <button
              type="button"
              className={styles.stagePlay}
              onClick={loop.toggle}
              aria-pressed={!loop.playing}
              aria-label={loop.playing ? controls.pause : controls.play}
            >
              {loop.playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
              <span>{loop.playing ? controls.pause : controls.play}</span>
            </button>
          )}
        </div>

        <div ref={host} className={styles.stageBody}>
          <p className={styles.stageLede}>{labels.lede}</p>

          {/* The scene sits directly on the stage: no frame, no panel, so the
              animation itself is the object on the page. */}
          <div className={styles.stageScene}>
            <CircuitTracesWide
              tone="quiet"
              dynamic
              seed={Array.from(id).reduce((seed, letter) => seed * 31 + letter.charCodeAt(0), 7) >>> 0}
              branches={5}
              pulse={active && !reduced}
              className={`pointer-events-none absolute bottom-0 h-1/2 w-4/5 opacity-70 ${copyRight ? "right-0 -scale-x-100" : "left-0"}`}
            />
            <motion.div className={styles.stageCanvas} style={{ opacity: reduced ? 1 : loop.fade }}>
              {mounted && <Canvas
                style={{ contain: "layout paint" }}
                shadows="percentage"
                camera={STAGE_CAMERA}
                dpr={[1, 1.5]}
                frameloop={reduced || !active ? "demand" : "always"}
                gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              >
                <Suspense fallback={<Html center><p role="status" className="whitespace-nowrap text-sm text-muted-foreground">{t("stages.loading")}</p></Html>}>
                  <SettleScene />
                  {scene(loop.progress, reduced, palette)}
                </Suspense>
              </Canvas>}
            </motion.div>
            <p className="sr-only">{labels.aria}</p>
          </div>

          <div className={styles.stageCopy}>
            {overview}
            <div className={styles.stageSteps}>
              {labels.steps.map((step, index) => {
                const shown = reduced || index === loop.index;
                return (
                  <motion.div
                    key={step.number}
                    className={styles.stageStep}
                    initial={false}
                    animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 10 }}
                    transition={{ duration: reduced ? 0 : 0.45, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <p className={styles.stageStepIndex}>{step.number} / {String(total).padStart(2, "0")}</p>
                    <h3 className={styles.stageStepTitle}>{step.title}</h3>
                    <p className={styles.stageStepBody}>{step.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
