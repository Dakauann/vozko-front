import { cn } from "@/lib/utils";

/**
 * What a button LOOKS like, declared once.
 *
 * Two button components ship in this app and both are load-bearing:
 * `elevated-design/button` is the one people reach for (129 files), and
 * `ui/button` exports `buttonVariants` as a class-string function, which the
 * shadcn primitives (alert-dialog, pagination, confirm-dialog) need because
 * they style their own elements rather than render a component.
 *
 * That is a fair reason for two components. It was never a reason for two
 * copies of the class strings, which is what they had: `primary`, `secondary`
 * and `ghost` were character-identical in both files, and `outline` was
 * identical right up until it wasn't — it went a half pixel heavier than every
 * field on the screen and nobody noticed for as long as the two were only ever
 * read one at a time.
 *
 * Both components import these. A change here reaches every button in the app,
 * which is the point.
 */

/** Rest → hover → pressed as discrete named steps, never an opacity fade. */
export const BUTTON_PRIMARY = cn(
  "bg-primary text-primary-foreground shadow-button-primary",
  "hover:bg-[hsl(var(--primary-hover))] hover:shadow-button-primary-hover",
  "active:bg-[hsl(var(--primary-active))] active:shadow-button-primary",
);

/** The quiet button: its 1px edge IS the first layer of --elev-button-quiet, so
 *  border and elevation compose instead of double-drawing an outline. */
export const BUTTON_SECONDARY = cn(
  "bg-card text-foreground shadow-quiet",
  "hover:shadow-quiet-hover",
  "active:bg-muted active:shadow-quiet",
);

/**
 * The FIELD pattern: a 1px --control-edge boundary on a card plate (a well in
 * dark), with the edge itself reacting to hover.
 *
 * A select trigger, an input and an outline button are the same object to
 * someone scanning a toolbar, and they were drawn differently — 1.5px against
 * the fields' 1px reads as a heavier corner arc and a different control at the
 * same size.
 *
 * Dropping to 1px does not weaken the boundary. The 3:1 comes from
 * --control-edge, the token that fixed the invisible 1.79:1 (light) / 1.36:1
 * (dark) edge this replaced; the extra half pixel was never carrying it, and
 * every field on the screen proves 1px on this token is enough.
 *
 * Press seats the control rather than tinting it: light darkens 100 → 93 → 89,
 * dark lifts 12 → 18 and then drops to 9, below its own rest.
 */
export const BUTTON_OUTLINE = cn(
  "border border-control-edge bg-card text-foreground dark:bg-muted",
  "hover:border-[hsl(var(--muted-foreground)/0.5)] hover:bg-muted dark:hover:bg-[hsl(var(--accent-hover))]",
  "active:bg-[hsl(var(--accent-hover))] dark:active:bg-card",
);

/**
 * Same edge, no plate — and THAT is the subtlety.
 *
 * It used to be the same plate one step lighter in weight, which made the two
 * outline variants differ only in half a pixel: indistinguishable in use, and
 * the reason nobody could tell which one a screen wanted. The axis that carries
 * meaning is whether the control claims a surface of its own.
 */
export const BUTTON_OUTLINE_SUBTLE = cn(
  "border border-control-edge bg-transparent text-foreground",
  "hover:border-[hsl(var(--muted-foreground)/0.5)] hover:bg-muted",
  "active:bg-[hsl(var(--accent-hover))]",
);

/** No box at all until you touch it. */
export const BUTTON_GHOST = cn(
  "bg-transparent text-muted-foreground",
  "hover:bg-muted hover:text-foreground",
  "active:bg-[hsl(var(--accent-hover))]",
);
