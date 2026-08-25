"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { Image as ImageIcon, VideoCamera, Warning } from "@/components/icons";
import type { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

// ── Shared building blocks for "renders like the real message" nodes ─────────
// These primitives are deliberately presentational and dependency-light so they
// can be reused across every message-sending node (WhatsApp text/buttons/list,
// template, media, SMS) and unit-tested in isolation.

// Real WhatsApp palette, theme-aware. A node previews the message the business
// SENDS, so the bubble is the OUTGOING green; interactive buttons/list rows sit
// on the separate white/dark surface WhatsApp renders them on. SMS/neutral
// messages opt out via the MessageBubble `theme` prop.
export const WA_CHAT_BG = "bg-[#efeae2] dark:bg-[#0b141a]";
export const WA_BUBBLE_BG = "bg-[#d9fdd3] dark:bg-[#005c4b]"; // outgoing green
export const WA_BUBBLE_TEXT = "text-[#111b21] dark:text-[#e9edef]";
export const WA_BUBBLE_MUTED = "text-[#4a7663] dark:text-[#9ec4b6]"; // on green
export const WA_SURFACE_BG = "bg-white dark:bg-[#233138]"; // button/list cards
export const WA_MUTED_TEXT = "text-[#667781] dark:text-[#8696a0]"; // on surface
export const WA_ACTION_TEXT = "text-[#008069] dark:text-[#00a884]"; // action/link
export const WA_DIVIDER = "border-black/[0.06] dark:border-white/10";

// centerWithin returns el's vertical center relative to `root` in LAYOUT pixels
// by walking offsetParent and summing offsetTop. Unlike getBoundingClientRect it
// is immune to the canvas zoom transform, so a source handle placed at this top
// stays aligned to its row at any zoom. Exported for unit testing.
export function centerWithin(el: HTMLElement, root: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top + el.offsetHeight / 2;
}

// EmptyPreview is the shared "nothing configured yet" hint used by node previews.
export function EmptyPreview({ label }: { label: string }) {
  return (
    <span className="text-2xs italic text-muted-foreground">{label}</span>
  );
}

// ── ChatSurface ──────────────────────────────────────────────────────────────
export function ChatSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-2 py-2", WA_CHAT_BG, className)}>{children}</div>;
}

// ── MessageBubble ────────────────────────────────────────────────────────────
type BubbleTheme = "whatsapp" | "neutral";

const BUBBLE_THEME: Record<
  BubbleTheme,
  { bubble: string; text: string; muted: string }
> = {
  whatsapp: {
    bubble: WA_BUBBLE_BG,
    text: WA_BUBBLE_TEXT,
    muted: WA_BUBBLE_MUTED,
  },
  neutral: {
    bubble: "bg-muted",
    text: "text-foreground/80",
    muted: "text-muted-foreground",
  },
};

export function MessageBubble({
  media,
  headerText,
  body,
  emptyBodyLabel = "Sem mensagem",
  footer,
  bodyClamp = "line-clamp-4",
  theme = "whatsapp",
  className,
}: {
  media?: { url: string; kind: "image" | "video" };
  headerText?: string;
  body?: string;
  emptyBodyLabel?: string;
  footer?: string;
  bodyClamp?: string;
  theme?: BubbleTheme;
  className?: string;
}) {
  const t = BUBBLE_THEME[theme];
  return (
    <div
      className={cn(
        "relative max-w-full rounded-md rounded-tl-sm shadow-sm",
        t.bubble,
        className,
      )}
    >
      {media && <MediaHeader url={media.url} kind={media.kind} />}
      <div className="px-2 py-1.5">
        {headerText?.trim() && (
          <p className={cn("mb-0.5 text-2xs font-semibold leading-snug", t.text)}>
            {headerText}
          </p>
        )}
        {body?.trim() ? (
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-2xs leading-snug",
              bodyClamp,
              t.text,
            )}
          >
            {body}
          </p>
        ) : (
          <p className={cn("text-2xs italic", t.muted)}>{emptyBodyLabel}</p>
        )}
        {footer?.trim() && (
          <p className={cn("mt-0.5 text-2xs leading-tight", t.muted)}>
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}

export function MediaHeader({
  url,
  kind,
}: {
  url: string;
  kind: "image" | "video";
}) {
  const trimmed = url.trim();
  const Icon = kind === "image" ? ImageIcon : VideoCamera;
  return (
    <div className="relative flex aspect-[16/7] items-center justify-center overflow-hidden rounded-t-md bg-black/5 dark:bg-white/5">
      {kind === "image" && trimmed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trimmed}
          alt="header"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Icon size={22} weight="duotone" className="text-black/25 dark:text-white/30" />
      )}
    </div>
  );
}

// ── ActionRowList ────────────────────────────────────────────────────────────
// The tappable rows below a message (reply buttons or list items). Each row
// exposes data-option-id and an optional rowRef so a node shell can align a
// source handle to it. Purely presentational.
export interface ActionRowItem {
  id: string;
  leading?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}

export function ActionRowList({
  rows,
  variant,
  rowRef,
}: {
  rows: ActionRowItem[];
  variant: "buttons" | "list";
  rowRef?: (el: HTMLDivElement | null, id: string) => void;
}) {
  if (variant === "buttons") {
    return (
      <div className="mt-1 space-y-1">
        {rows.map((r) => (
          <div
            key={r.id}
            data-option-id={r.id}
            ref={rowRef ? (el) => rowRef(el, r.id) : undefined}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 shadow-sm",
              WA_SURFACE_BG,
            )}
          >
            {r.leading}
            <span className={cn("truncate text-2xs font-medium", WA_ACTION_TEXT)}>
              {r.primary}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("mt-1 overflow-hidden rounded-md shadow-sm", WA_SURFACE_BG)}>
      {rows.map((r, i) => (
        <div
          key={r.id}
          data-option-id={r.id}
          ref={rowRef ? (el) => rowRef(el, r.id) : undefined}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5",
            i > 0 && "border-t",
            WA_DIVIDER,
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-2xs font-medium leading-tight",
                WA_BUBBLE_TEXT,
              )}
            >
              {r.primary}
            </p>
            {r.secondary && (
              <p className={cn("truncate text-2xs leading-tight", WA_MUTED_TEXT)}>
                {r.secondary}
              </p>
            )}
          </div>
          {r.trailing}
        </div>
      ))}
    </div>
  );
}

// ── InteractiveNodeShell ─────────────────────────────────────────────────────
// The reusable node shell for "message on top, branches on the buttons, id bar
// on the bottom" nodes. It owns the DOM measurement so a source handle lines up
// with each branch row at any zoom, and renders the input handle, card, and id
// bar. Children get a `registerRow` callback to tag the rows that own a handle.
export interface ShellBranch {
  id: string;
  /** Tailwind border class for the handle pad. Defaults to branchDotClass(id). */
  dot?: string;
  /** Required outputs get a small red marker (they must be connected). */
  required?: boolean;
}

// Trace-pad handles — the brand's signature terminal (see components/brand/
// circuit.tsx: trace runs end in SQUARE pads, not dots). Rest is a card-filled
// pad on a hairline border; hover and the drag/valid connection states are the
// brand-green moments. Geometry + interaction states live here once; each
// handle adds only its position and (for branches) the semantic border tone.
const HANDLE_PAD_CLASS =
  "!h-[9px] !w-[9px] !rounded-[2px] !border-2 !bg-card " +
  "hover:!border-primary [&.connectingfrom]:!border-primary " +
  "[&.connectingto]:!border-primary [&.valid]:!border-primary [&.valid]:!bg-primary";

// branchDotClass is the ONE place branch-handle tones are decided, so every
// multi-output node (send-button catch-alls, condition, http, ai_agent, wait…)
// tones its pads the same way instead of hardcoding per node. Semantic by the
// branch id, carried on the pad's BORDER (the fill stays the card surface):
// failure → destructive, timeout/warning → warning, positive outcome → healthy,
// neutral fallback and everything else → the strong hairline (brand green is
// reserved for selection/connection states).
export function branchDotClass(id: string): string {
  const k = id.trim().toLowerCase();
  if (/(erro|error|falh|fail|send_failed)/.test(k)) return "!border-destructive";
  if (/(timeout|no_reply|tempo|esgotad|expir)/.test(k)) return "!border-warning";
  if (/(no_match|^default$|padr)/.test(k)) return "!border-border-strong";
  if (/(sucesso|success|verdadeiro|^true$|passed|replied|respond)/.test(k))
    return "!border-healthy";
  if (/(^false$|^falso$)/.test(k)) return "!border-destructive";
  return "!border-border-strong";
}

// BranchRow is the ONE row style for a node's outgoing branch, used by every
// multi-output node (send-button catch-alls, condition, http, ai_agent, wait…).
// It carries data-option-id and a measured ref so the shell aligns a handle to
// it. Quiet, uppercase, right-aligned, the state lives on the handle dot, not
// in colored text, so the canvas reads as one system.
export function BranchRow({
  id,
  label,
  registerRow,
}: {
  id: string;
  label: string;
  registerRow: (el: HTMLElement | null, id: string) => void;
}) {
  return (
    <div
      data-option-id={id}
      ref={(el) => registerRow(el, id)}
      className="flex h-5 items-center justify-end gap-1.5 pr-4"
    >
      <span className="truncate text-2xs font-semibold tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// BranchRows wraps a node's BranchRow list: dividers BETWEEN rows via divide-y,
// and a top border only when there is content above (so a node with no content
// preview doesn't get a stray line at the card's top edge).
export function BranchRows({
  children,
  hasContentAbove,
}: {
  children: ReactNode;
  hasContentAbove: boolean;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/30 bg-card",
        hasContentAbove && "border-t border-border",
      )}
    >
      {children}
    </div>
  );
}

// A small "must be connected" dot at the handle's top-left corner. Rendered as a
// child of the Handle so it's pixel-exact regardless of the handle's position.
function RequiredHandleMarker() {
  return (
    <span
      className="pointer-events-none absolute -left-0.5 -top-0.5 h-1 w-1 rounded-full bg-destructive ring-1 ring-background"
      title="Conexão obrigatória"
    />
  );
}

export interface InteractiveNodeShellProps {
  id: string;
  label: string;
  icon: Icon;
  iconColor: string;
  /** Glyph color on the category tile; defaults to white. Amber passes the
   *  near-black its own foreground token defines, because white on amber
   *  measures under 3:1 in the light theme. */
  iconInk?: string;
  width: number;
  branches: ShellBranch[];
  selected?: boolean;
  flashAt?: number | null;
  /** Stagger index for the copilot "fade in" of AI-added nodes; null = no anim. */
  appearSeq?: number | null;
  hasMissingRequired?: boolean;
  isSimulating?: boolean;
  /** Canvas search (Ctrl+F): this node matches the current query. */
  searchMatch?: boolean;
  /** Canvas search is active and this node is NOT a match, so fade it back. */
  searchDim?: boolean;
  /** Triggers have no incoming edge. */
  hideInputHandle?: boolean;
  /** End nodes have no outgoing edge. */
  hideOutputHandle?: boolean;
  /** Whether the single default output (no branches) is a required connection.
   *  Non-end nodes must have an outgoing edge, so this defaults to true. */
  defaultOutputRequired?: boolean;
  children: (api: {
    registerRow: (el: HTMLElement | null, id: string) => void;
  }) => ReactNode;
}

export function InteractiveNodeShell({
  id,
  label,
  icon: IconComp,
  iconColor,
  iconInk = "#ffffff",
  width,
  branches,
  selected,
  flashAt = null,
  appearSeq = null,
  hasMissingRequired,
  isSimulating,
  searchMatch,
  searchDim,
  hideInputHandle,
  hideOutputHandle,
  defaultOutputRequired = true,
  children,
}: InteractiveNodeShellProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const branchSig = branches.map((b) => b.id).join("|");

  const rootRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef<Map<string, HTMLElement>>(new Map());
  const [tops, setTops] = useState<Record<string, number>>({});

  const registerRow = useCallback((el: HTMLElement | null, rid: string) => {
    if (el) rowEls.current.set(rid, el);
    else rowEls.current.delete(rid);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const next: Record<string, number> = {};
      for (const b of branches) {
        const el = rowEls.current.get(b.id);
        if (el) next[b.id] = centerWithin(el, root);
      }
      setTops((prev) => {
        const keys = Object.keys(next);
        if (
          keys.length === Object.keys(prev).length &&
          keys.every((k) => Math.abs((prev[k] ?? -1) - next[k]) < 0.5)
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchSig, selected]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, tops, updateNodeInternals]);

  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (flashAt == null) return;
    setFlashing(true);
    const tid = setTimeout(() => setFlashing(false), 2300);
    return () => clearTimeout(tid);
  }, [flashAt]);

  const hasBranches = branches.length > 0;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative transition-opacity duration-200",
        searchDim && "opacity-30",
      )}
      style={{ width }}
    >
      {!hideInputHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(HANDLE_PAD_CLASS, "!-left-[5px] !border-border-strong")}
        />
      )}

      <motion.div
        initial={appearSeq != null ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{
          delay: (appearSeq ?? 0) * 0.07,
          duration: 0.3,
          ease: "easeOut",
        }}
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-card shadow-md transition-all",
          !selected && "hover:border-border-strong",
          // Selection is a brand state, as everywhere else in the product;
          // the near-black ring this replaces read as an error outline.
          selected &&
            "border-primary ring-2 ring-primary/30 shadow-lg",
          Boolean(isSimulating) &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg animate-pulse",
          // Search match wins over the selection ring (ordered last) so a found
          // node is unmistakable even when it is also the selected one.
          searchMatch &&
            "ring-[3px] ring-warning ring-offset-2 ring-offset-background shadow-lg shadow-warning/30",
        )}
      >
        {flashing && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-muted ring-2 ring-inset ring-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.2, times: [0, 0.08, 0.65, 1], ease: "easeOut" }}
          />
        )}

        {/* HEADER bar — the Azure Logic Apps card anatomy: the coloured
            category tile and the node's name lead the card, content hangs
            below. This was a footer, which made every node read as an
            unlabeled preview until the eye reached its last line. */}
        <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5">
          <div
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[--radius] shadow-sm"
            style={{ backgroundColor: iconColor }}
          >
            <IconComp size={11} weight="fill" style={{ color: iconInk }} />
          </div>
          <span className="min-w-0 flex-1 truncate text-2xs font-semibold text-foreground">
            {label}
          </span>
          {Boolean(hasMissingRequired) && (
            <Warning size={12} weight="fill" className="shrink-0 text-warning-ink" />
          )}
          <span className="pointer-events-none font-mono text-2xs font-medium text-muted-foreground">
            {id}
          </span>
        </div>

        {children({ registerRow })}
      </motion.div>

      {hasBranches
        ? branches.map((b) => {
            const top = tops[b.id];
            if (top == null) return null;
            return (
              <Handle
                key={b.id}
                type="source"
                position={Position.Right}
                id={b.id}
                style={{ top }}
                className={cn(
                  HANDLE_PAD_CLASS,
                  "!-right-[5px]",
                  b.dot ?? branchDotClass(b.id),
                )}
              >
                {b.required && <RequiredHandleMarker />}
              </Handle>
            );
          })
        : !hideOutputHandle && (
            <Handle
              type="source"
              position={Position.Right}
              className={cn(HANDLE_PAD_CLASS, "!-right-[5px] !border-border-strong")}
            >
              {defaultOutputRequired && <RequiredHandleMarker />}
            </Handle>
          )}
    </div>
  );
}
