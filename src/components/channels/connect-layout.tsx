"use client";

import { CheckCircle, Warning, WarningCircle } from "@/components/icons";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * DIRECTION CONTRACT
 *
 * THESIS: a connect screen is one task on one track. It refuses the two-column
 * work/reference split these three pages shared, which gave a brochure the same
 * visual weight as the only action on the page and parked the action beside the
 * instructions that make it completable rather than after them.
 *
 * OWN-WORLD: the incumbent dashboard system, unchanged. ElevatedContainer's
 * layered shadow on bg-card, rounded-[--radius], border-token hairlines, Phosphor
 * icons at one weight, the primary token carrying the action. Colour appears
 * only as a solid fill under contrasting ink, never as a tint behind text of
 * its own hue.
 *
 * STORY: an admin who already chose a channel learns what must be true before
 * starting, does the one thing this screen exists for, and lands on a
 * confirmation that names what connected and where to go next.
 *
 * FIRST VIEWPORT: a compact identity row (channel mark, title, one line naming
 * what this connection is), then a single panel holding one numbered rail whose
 * last stop IS the action, form or launcher. Nothing sits above the rail that
 * the operator cannot yet act on.
 *
 * FORM: stateful single track, candidate 3 of 7 grounded structures, seed key
 * 06e478de.
 *
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, and DESIGN.md
 */

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export const connectMotion = { container, item };

/**
 * ConnectShell owns the page's width and rhythm.
 *
 * max-w-3xl, not the 6xl the two-column version needed. One track has one
 * measure, and a single column stretched to 1150px puts the eye on a return
 * journey between the step number and the words beside it.
 */
export function ConnectShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.main
      variants={container}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      // 20px is the in-group rhythm: back link, identity and panel are one
      // group, the task. The seam between that group and the reference
      // material below it is doubled by ConnectSupporting. Previously every
      // seam was an identical 24px, so nothing grouped.
      className={cn("mx-auto w-full max-w-3xl space-y-5 pb-20", className)}
    >
      {children}
    </motion.main>
  );
}

/** One staggered block. */
export function ConnectBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * ConnectIdentity names the channel and what connecting it actually means.
 *
 * The three heroes it replaces spent a full viewport on two logo tiles, a
 * connector line, three ambient blur glows and a 4xl title, so on a laptop the
 * first thing the operator came for sat below the fold. The channel is already
 * known (they arrived from its own listing page), so identity is a header, not
 * a stage: it states which channel and one honest line about the kind of
 * connection, then gets out of the way.
 */
export function ConnectIdentity({
  logo,
  title,
  lead,
  meta,
}: {
  logo: ReactNode;
  title: string;
  lead: string;
  /** Short factual qualifier, e.g. the official-provider badge. */
  meta?: ReactNode;
}) {
  return (
    <motion.header variants={item} className="flex items-start gap-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-card shadow-[0_1px_2px_-1px_rgba(0,0,0,0.10),0_3px_8px_-3px_rgba(0,0,0,0.12)]">
        {logo}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {/* Held to a readable measure rather than the container's full width. */}
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {lead}
        </p>
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
    </motion.header>
  );
}

const PANEL_SHADOW =
  "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

/**
 * The panel's surface, with no animation of its own.
 *
 * Split out because the animated wrapper below cannot be nested inside another
 * motion component that animates with plain objects: variant labels only
 * propagate to children through other variant-driven parents, so a panel that
 * depends on propagation renders at its `hidden` variant, fully transparent,
 * and never advances. That shipped: a connected bot showed an empty screen with
 * the whole confirmation present in the DOM at opacity 0.
 *
 * Anything that must be visible unconditionally uses this directly.
 */
function PanelSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[--radius] border border-border bg-card p-6 sm:p-8",
        className,
      )}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      {children}
    </div>
  );
}

/**
 * ConnectPanel is the single surface the whole task lives on.
 *
 * One panel, not a stack of them: an operator doing a five-minute setup should
 * never have to work out which of four cards is the one that acts.
 *
 * It joins the shell's stagger, so it is only for content whose parent drives
 * variants. Content that must appear regardless uses PanelSurface.
 */
export function ConnectPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item}>
      <PanelSurface className={className}>{children}</PanelSurface>
    </motion.div>
  );
}

/**
 * ConnectTrack is the rail the task runs down.
 *
 * The numbers are load-bearing rather than decorative: each stop is a hard
 * prerequisite for the next, several happen in another application entirely,
 * and the operator needs to hold their place while switching away. That is the
 * one condition that earns numbering.
 */
export function ConnectTrack({ children }: { children: ReactNode }) {
  // No `space-y` here on purpose. A margin between the items would sit OUTSIDE
  // each row's content box, and the rail is a flex child of that box, so the
  // line stopped short and restarted below the gap: the sequence read as four
  // detached rows with stubs of line between them. The gap is padding on each
  // row's body instead, which the marker column stretches to cover.
  return <ol>{children}</ol>;
}

/**
 * One stop on the rail.
 *
 * `isAction` marks the stop where the operator finally does the thing. It reads
 * heavier than the instructions above it, because a rail whose last stop looks
 * like every other stop hides the only control on the page.
 *
 * The connecting line is drawn down from each marker instead of between
 * siblings, so a stop whose body is an entire form still reads as part of the
 * sequence; the rail grows with its content rather than assuming equal rows.
 */
export function ConnectTrackStep({
  index,
  title,
  text,
  isLast,
  isAction,
  children,
}: {
  index: number;
  title?: string;
  text?: string;
  isLast?: boolean;
  isAction?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      <div className="relative flex flex-col items-center">
        {/* Solid tone, contrasting ink. The action stop carries the primary
            token; the instruction stops stay neutral so the one that acts is
            the one that stands out. */}
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
            isAction
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
          )}
        >
          {index}
        </span>
        {!isLast && <span aria-hidden className="mt-2 w-px flex-1 bg-border" />}
      </div>

      {/* The spacing between stops lives here, so the rail spans it. */}
      <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-7")}>
        {title && (
          <h2 className="text-sm font-semibold leading-6 text-foreground">{title}</h2>
        )}
        {text && (
          <p
            className={cn(
              "max-w-prose text-sm leading-relaxed text-muted-foreground",
              title && "mt-1",
            )}
          >
            {text}
          </p>
        )}
        {children && <div className={cn(title || text ? "mt-4" : "")}>{children}</div>}
      </div>
    </li>
  );
}

/**
 * ConnectNotice is a fact the operator has to read, not a decorated aside.
 *
 * The surface stays neutral and the hue lives in a solid mark. The banners this
 * replaces set emerald-900 text on an emerald-50 wash and rose-900 on rose-50,
 * which is the one colour move this product bans: same-hue ink on a same-hue
 * tint has nowhere to go for contrast once the surface itself is tinted, and it
 * washes out completely in dark mode.
 */
export function ConnectNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger";
  children: ReactNode;
}) {
  const marks = {
    info: {
      Icon: WarningCircle,
      chip: "bg-muted text-white",
      label: "",
    },
    warn: {
      Icon: Warning,
      chip: "bg-warning text-white",
      label: "",
    },
    danger: {
      Icon: Warning,
      chip: "bg-destructive text-destructive-foreground",
      label: "",
    },
  }[tone];
  const { Icon, chip } = marks;

  return (
    <div className="flex gap-3 rounded-[--radius] border border-border bg-muted p-4">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          chip,
        )}
      >
        <Icon weight="fill" className="size-3.5" />
      </span>
      <div className="min-w-0 max-w-prose space-y-1 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * ConnectSupporting holds everything that is not the task.
 *
 * Its only job is the seam: double the in-group rhythm above it, so the panel
 * reads as finished and what follows reads as reference rather than as the next
 * thing to do.
 */
export function ConnectSupporting({ children }: { children: ReactNode }) {
  return <div className="space-y-5 pt-5">{children}</div>;
}

/**
 * ConnectFacts is the supporting material, demoted to where it belongs.
 *
 * It was three equal-weight icon cards in a row on two of these pages, which is
 * the lazy page scaffold: it gave "what you get" the same presence as the task
 * and cost a full row of vertical space to say three short things. A definition
 * list says the same thing in a third of the height and never competes with the
 * rail above it.
 */
export function ConnectFacts({
  title,
  items,
}: {
  title: string;
  items: { term: string; detail: string }[];
}) {
  return (
    <motion.section variants={item}>
      {/* Same weight and colour as the terms it labels, not smaller and
          lighter. A 12px tracked muted line above content is the kicker shape
          the house style refuses, and it left the heading receding behind its
          own list items. */}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {/* auto-fit, so three facts do not leave a permanent empty cell in a
          two-column grid. */}
      <dl className="mt-4 grid gap-x-8 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {items.map((fact) => (
          <div key={fact.term} className="min-w-0">
            <dt className="text-sm font-medium text-foreground">{fact.term}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {fact.detail}
            </dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}

/**
 * ConnectResult replaces the track once the task has resolved.
 *
 * Success used to be a green banner stacked above the form the operator had
 * just finished, so the screen still read as work outstanding. A finished task
 * should look finished: the thing that resolved is named, and the only controls
 * are the next moves.
 */
export function ConnectResult({
  status,
  title,
  body,
  details,
  actions,
}: {
  status: "success" | "error";
  title: string;
  body: string;
  /** Identifiers worth keeping visible, e.g. the connected handle or phone id. */
  details?: { label: string; value: string }[];
  actions: ReactNode;
}) {
  const ok = status === "success";
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The panel this replaces is destroyed, so focus would fall to <body> and a
  // screen reader user would hear only the toast, then restart from the top of
  // the document with no idea the task completed.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <motion.div
      // No `variants` here, and PanelSurface rather than ConnectPanel below.
      // Animating with objects stops variant labels propagating, so a
      // variant-driven child would sit at `hidden` forever.
      //
      // The one authored moment on the page: the result arrives with a short
      // rise, because it replaces content rather than joining it.
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
    >
      <PanelSurface>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-6">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              ok
                ? "bg-healthy text-white"
                : "bg-destructive text-destructive-foreground",
            )}
          >
            {ok ? (
              <CheckCircle weight="fill" className="size-6" />
            ) : (
              <Warning weight="fill" className="size-6" />
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold tracking-tight text-foreground outline-none"
              >
                {title}
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>

            {details && details.length > 0 && (
              // Monospace here is measurement, not costume: these are opaque
              // identifiers an operator copies into a support ticket.
              <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-[--radius] border border-border bg-muted px-4 py-3">
                {details.map((d) => (
                  <div key={d.label} className="min-w-0">
                    {/* Foreground, not muted: at 11px on the notice's own
                        tinted surface the muted token falls under 4.5:1. */}
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-foreground/80">
                      {d.label}
                    </dt>
                    <dd className="truncate font-mono text-xs text-foreground">
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
          </div>
        </div>
      </PanelSurface>
    </motion.div>
  );
}
