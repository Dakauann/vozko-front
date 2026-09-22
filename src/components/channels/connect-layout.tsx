"use client";

import { CheckCircle, Warning, WarningCircle } from "@/components/icons";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";


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
      className={cn("mx-auto w-full max-w-3xl space-y-5 pb-20", className)}
    >
      {children}
    </motion.main>
  );
}

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

export function ConnectIdentity({
  logo,
  title,
  lead,
  meta,
}: {
  logo: ReactNode;
  title: string;
  lead: string;
  meta?: ReactNode;
}) {
  return (
    <motion.header variants={item} className="flex items-start gap-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
        {logo}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <h1 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground sm:text-2xl">
          {title}
        </h1>
        {}
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {lead}
        </p>
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
    </motion.header>
  );
}

const PANEL_SHADOW =
  "var(--elev-1)";

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
        "relative overflow-hidden rounded-lg border border-border bg-card p-6 sm:p-8",
        className,
      )}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      {children}
    </div>
  );
}

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

export function ConnectTrack({ children }: { children: ReactNode }) {
  return <ol>{children}</ol>;
}

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
        {
}
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

      {}
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
      chip: "bg-card text-muted-foreground ring-1 ring-inset ring-border",
      label: "",
    },
    warn: {
      Icon: Warning,
      chip: "bg-card text-warning-ink ring-1 ring-inset ring-border",
      label: "",
    },
    danger: {
      Icon: Warning,
      chip: "bg-card text-destructive-ink ring-1 ring-inset ring-border",
      label: "",
    },
  }[tone];
  const { Icon, chip } = marks;

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-muted p-4">
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

export function ConnectSupporting({ children }: { children: ReactNode }) {
  return <div className="space-y-5 pt-5">{children}</div>;
}

export function ConnectFacts({
  title,
  items,
}: {
  title: string;
  items: { term: string; detail: string }[];
}) {
  return (
    <motion.section variants={item}>
      {
}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {
}
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
  details?: { label: string; value: string }[];
  actions: ReactNode;
}) {
  const ok = status === "success";
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <motion.div
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
                ? "bg-healthy text-healthy-foreground"
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
                className="font-display text-lg font-semibold tracking-[0.01em] text-foreground outline-none"
              >
                {title}
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>

            {details && details.length > 0 && (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-[--radius] border border-border bg-muted px-4 py-3">
                {details.map((d) => (
                  <div key={d.label} className="min-w-0">
                    {
}
                    <dt className="text-2xs font-medium text-foreground/80">
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
