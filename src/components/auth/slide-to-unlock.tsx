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

/**
 * The commit gate on the login plate.
 *
 * A deliberate physical gesture between filling the credentials and the key
 * going live. It makes no security claim and is not one: everything it guards
 * is guarded again on the server. What it buys is a moment of ceremony on the
 * one screen in this product that is otherwise pure transaction.
 *
 * Three states, and each is legible on its own:
 *
 *   inert     the fields are not both filled. A --muted recess with a label and
 *             no thumb, because there is nothing to grab yet.
 *   armed     both fields have content. The thumb arrives. This is the only
 *             arrival animation on the login screen and it earns it — it is the
 *             form saying it is ready.
 *   committing the thumb crossed 90% of travel. The fill completes, the mark
 *             becomes a check, and the track hands off to the button.
 *
 * Three details carry it.
 *
 * The label renders TWICE. As --primary floods the track, the text crosses from
 * a light ground to a saturated one, and no single ink is legible on both. So a
 * --muted-foreground copy sits underneath and a --primary-foreground copy is
 * clipped to exactly the fill width on top. Contrast is correct per pixel
 * through the sweep, and the letters appear to invert under the wave.
 *
 * The drag is 1:1 with NO easing, and it never touches React. Width and
 * transform are driven straight off the motion value, so dragging does not
 * re-render this component at all; a setState per frame is what turns a 1:1
 * gesture into a laggy one. Easing belongs to the release, not to the travel.
 *
 * There is deliberately no shimmer on the track. This system allows exactly two
 * looping animations product-wide and both report live work; a decorative sweep
 * in an operator's periphery is the device already removed once from IconBox.
 */

/** Fraction of travel that commits. Below it, the thumb springs home. */
const COMMIT_AT = 0.9;

/** How long the completed bar holds before handing off to the button. */
const HOLD_MS = 200;

/** Thumb diameter and its inset from the track edge, in px. */
const THUMB = 32;
const INSET = 4;

/** Arrivals decelerate, departures accelerate — the system's panel/exit pair. */
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
  /** Both credentials have content. The gate stays inert until they do. */
  armed: boolean;
  onUnlock: () => void;
  /** Shown while inert — names the precondition, not the gesture. */
  label: string;
  /** Shown while armed — names the gesture. */
  armedLabel: string;
  /** Shown and announced once committed. */
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

  // The fill is the thumb's leading edge, so colour arrives exactly where the
  // finger is rather than trailing it. Derived, never stored in state.
  const fill = useTransform(x, (v) => v + THUMB + INSET * 2);

  // The track is fluid and the longest drag label is German, so travel is
  // measured rather than assumed.
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

  // Arming and locking share one predicate. Clearing a field takes the gate
  // back; fixing a typo after unlocking does not, and neither does a failed
  // attempt — a second drag is not a meaningful answer to a wrong password.
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

  // A keyboard user gets the same state change without the drag. This is a
  // path, not a fallback: the fill runs, the mark flips, the handoff is
  // identical.
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
      {/* The flood, behind everything.

          Gated on the same phase as the thumb. `fill` is the thumb's leading
          edge — x + THUMB + INSET*2 — so at rest it is 40px wide, not zero.
          With the thumb hidden in the inert phase, that left a 40px block of
          brand orange sitting at the edge of the track with nothing to explain
          it: the control's most prominent feature, in its most common state,
          read as a rendering fault. Colour arrives with the thing pushing it. */}
      {phase !== "inert" && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: fill }}
          aria-hidden
        />
      )}

      {/* Label, layer one: on the muted ground ahead of the fill. */}
      <span
        className="legend pointer-events-none absolute inset-0 flex items-center justify-center !text-muted-foreground"
        aria-hidden
      >
        {text}
      </span>

      {/* Label, layer two: on the primary ground behind it, clipped to the fill
          so the two copies meet exactly at the thumb's leading edge. The inner
          span keeps the full track width, or the text would re-centre inside
          the shrinking clip and slide against itself. */}
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

      {/* The thumb. A white disc on both grounds, so it never dissolves into
          the fill it is pushing. */}
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
