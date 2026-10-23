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
} from "@xyflow/react";
import { motion } from "framer-motion";
import { Image as ImageIcon, PushPin, VideoCamera, Warning } from "@/components/icons";
import type { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { NODE_ACTIVE, NODE_BREAKPOINT, NODE_PAUSED, NODE_REAL_CALL, hasDebugFlag } from "@/lib/workflows/debug-marks";
import {
  COMPACT_HEADER_PX,
  SUMMARY_LINE_PX,
  compactContentHeight,
  handleCenters,
  summaryLineCount,
  useNodeDetail,
  type CompactTier,
} from "./canvas-detail";
import type { NodeSummary } from "./node-previews/node-summary";
import { MISSING_OUTPUT_TITLE, MissingOutputRows, useMissingOutputs } from "./missing-outputs";
import { TemplateRefText } from "./template-ref-text";
import { useBatchedNodeInternals } from "./node-internals-batch";
import { useNodeDebugFlags } from "./node-debug-marks";
import { useRunNodeMark } from "./run-overlay";
import { useNodeChoiceStats, type NodeChoiceView } from "./choice-stats-store";
import { NodeChoiceLine } from "./node-choice-stats";


const WA_CHAT_BG = "bg-[#efeae2] dark:bg-[#0b141a]";
const WA_BUBBLE_BG = "bg-[#d9fdd3] dark:bg-[#005c4b]";
export const WA_BUBBLE_TEXT = "text-[#111b21] dark:text-[#e9edef]";
export const WA_BUBBLE_MUTED = "text-[#4a7663] dark:text-[#9ec4b6]";
export const WA_SURFACE_BG = "bg-white dark:bg-[#233138]";
export const WA_MUTED_TEXT = "text-[#667781] dark:text-[#8696a0]";
export const WA_ACTION_TEXT = "text-[#008069] dark:text-[#00a884]";
const WA_DIVIDER = "border-black/[0.06] dark:border-white/10";

export function centerWithin(el: HTMLElement, root: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top + el.offsetHeight / 2;
}

export function EmptyPreview({ label }: { label: string }) {
  return (
    <span className="text-2xs italic text-muted-foreground">{label}</span>
  );
}

export function ChatSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-2 py-2", WA_CHAT_BG, className)}>{children}</div>;
}

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
            <TemplateRefText text={body} />
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

export const NODE_MEDIA_BOX = { width: 210, height: 128 } as const;
export const NODE_MEDIA_GLANCE_BOX = { width: 210, height: 96 } as const;
const HEADER_MEDIA_BOX = { width: 216, height: 95 } as const;

function hideBrokenMedia(e: { currentTarget: HTMLElement }) {
  e.currentTarget.style.display = "none";
}

export function PreviewImage({
  src,
  alt,
  box,
  priority,
  className,
}: {
  src: string;
  alt: string;
  box: { width: number; height: number };
  priority: "low" | "auto";
  className: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={box.width}
      height={box.height}
      decoding="async"
      loading="lazy"
      fetchPriority={priority}
      draggable={false}
      className={className}
      onError={hideBrokenMedia}
    />
  );
}

export function MessageMediaGlance({ url }: { url: string }) {
  return (
    <ChatSurface>
      <div className="overflow-hidden rounded-md">
        <MediaHeader url={url} kind="image" priority="low" />
      </div>
    </ChatSurface>
  );
}

function MediaHeader({
  url,
  kind,
  priority = "auto",
}: {
  url: string;
  kind: "image" | "video";
  priority?: "low" | "auto";
}) {
  const trimmed = url.trim();
  const Icon = kind === "image" ? ImageIcon : VideoCamera;
  return (
    <div className="relative flex aspect-[16/7] items-center justify-center overflow-hidden rounded-t-md bg-black/5 dark:bg-white/5">
      {kind === "image" && trimmed ? (
        <PreviewImage
          src={trimmed}
          alt="header"
          box={HEADER_MEDIA_BOX}
          priority={priority}
          className="h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Icon size={22} weight="duotone" className="text-black/25 dark:text-white/30" />
      )}
    </div>
  );
}

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
              "relative flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 shadow-sm",
              r.trailing != null && "pr-14",
              WA_SURFACE_BG,
            )}
          >
            {r.leading}
            <span className={cn("truncate text-2xs font-medium", WA_ACTION_TEXT)}>
              {r.primary}
            </span>
            {r.trailing != null && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2">{r.trailing}</span>
            )}
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

export interface ShellBranch {
  id: string;
  dot?: string;
  required?: boolean;
  label?: string;
  missing?: boolean;
}

const HANDLE_PAD_CLASS =
  "!h-[9px] !w-[9px] !rounded-[2px] !border-2 !bg-card " +
  "hover:!border-primary [&.connectingfrom]:!border-primary " +
  "[&.connectingto]:!border-primary [&.valid]:!border-primary [&.valid]:!bg-primary";

function branchDotClass(id: string): string {
  const k = id.trim().toLowerCase();
  if (/(erro|error|falh|fail|send_failed)/.test(k)) return "!border-destructive";
  if (/(timeout|no_reply|tempo|esgotad|expir)/.test(k)) return "!border-warning";
  if (/(no_match|^default$|padr)/.test(k)) return "!border-control-edge";
  if (/(sucesso|success|verdadeiro|^true$|passed|replied|respond)/.test(k))
    return "!border-healthy";
  if (/(^false$|^falso$)/.test(k)) return "!border-destructive";
  return "!border-control-edge";
}

export function BranchRow({
  id,
  label,
  icon,
  registerRow,
}: {
  id: string;
  label: string;
  icon?: ReactNode;
  registerRow: (el: HTMLElement | null, id: string) => void;
}) {
  return (
    <div
      data-option-id={id}
      ref={(el) => registerRow(el, id)}
      className="flex h-5 items-center justify-end gap-1.5 pr-4"
    >
      {icon ? (
        <span aria-hidden className="flex h-3 w-3 shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span className="truncate text-2xs font-semibold tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

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

function RequiredHandleMarker() {
  return (
    <span
      className="pointer-events-none absolute -left-0.5 -top-0.5 h-1 w-1 rounded-full bg-destructive ring-1 ring-background"
      title="Conexão obrigatória"
    />
  );
}

const COMPACT_TITLE_CLASS: Record<CompactTier, string> = {
  simplified: "text-[15px]",
  minimal: "text-[24px] leading-tight",
};

const SUMMARY_UNDER_GLANCE_PX = 52;

const COMPACT_ICON: Record<CompactTier, { box: number; glyph: number }> = {
  simplified: { box: 22, glyph: 13 },
  minimal: { box: 30, glyph: 18 },
};

function CompactSummary({
  tier,
  summary,
  height,
}: {
  tier: CompactTier;
  summary: NodeSummary;
  height: number;
}) {
  if (tier === "minimal") {
    const line = (summary.heading || summary.text || "").split("\n")[0];
    return (
      <p className="truncate px-2.5 py-1 text-[18px] leading-snug text-muted-foreground">
        {line}
      </p>
    );
  }
  const lines = summary.text ? summaryLineCount(height, Boolean(summary.heading)) : 0;
  return (
    <div className="px-2.5 py-2">
      {summary.heading && (
        <p className="truncate text-[14px] font-semibold leading-5 text-foreground">
          {summary.heading}
        </p>
      )}
      {lines > 0 && (
        <p
          className="whitespace-pre-line break-words text-[13px] text-foreground/75"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: lines,
            overflow: "hidden",
            lineHeight: `${SUMMARY_LINE_PX}px`,
          }}
        >
          {summary.text}
        </p>
      )}
    </div>
  );
}

function CompactNodeCard({
  tier,
  className,
  icon: IconComp,
  iconColor,
  iconInk,
  label,
  warning,
  pinned,
  glance,
  summary,
  branches,
  branchTops,
  height,
  choice,
}: {
  choice: NodeChoiceView | null;
  tier: CompactTier;
  className: string;
  icon: Icon;
  iconColor: string;
  iconInk: string;
  label: string;
  warning: boolean;
  pinned: boolean;
  glance: ReactNode;
  summary: NodeSummary | null;
  branches: ShellBranch[];
  branchTops: Record<string, number>;
  height: number;
}) {
  const labelled = tier === "simplified" ? branches.filter((b) => b.label && branchTops[b.id] != null) : [];
  const contentHeight = compactContentHeight(tier, height, labelled.map((b) => branchTops[b.id]));
  const icon = COMPACT_ICON[tier];
  return (
    <div className={className} data-detail-tier={tier}>
      <div
        className="flex items-center gap-2 border-b border-border bg-card px-2.5"
        style={{ height: COMPACT_HEADER_PX[tier] }}
      >
        <div
          className="flex shrink-0 items-center justify-center rounded-[--radius]"
          style={{ backgroundColor: iconColor, width: icon.box, height: icon.box }}
        >
          <IconComp size={icon.glyph} weight="fill" style={{ color: iconInk }} />
        </div>
        <span className={cn("min-w-0 flex-auto truncate font-semibold text-foreground", COMPACT_TITLE_CLASS[tier])}>
          {label}
        </span>
        {warning && <Warning size={icon.glyph} weight="fill" className="shrink-0 text-warning-ink" />}
        {pinned && <PushPin size={icon.glyph} weight="fill" aria-label="Saída fixada" className="shrink-0 text-primary-ink" />}
      </div>
      <div className="overflow-hidden" style={{ height: contentHeight }}>
        {tier === "simplified" && choice && <NodeChoiceLine view={choice} size="simplified" />}
        {tier === "minimal" && summary && <CompactSummary tier={tier} summary={summary} height={contentHeight} />}
        {glance}
        {tier === "simplified" && summary && (
          <CompactSummary tier={tier} summary={summary} height={glance ? SUMMARY_UNDER_GLANCE_PX : contentHeight} />
        )}
      </div>
      {labelled.map((b) => (
        <span
          key={b.id}
          data-branch-label
          className="pointer-events-none absolute right-4 max-w-[80%] -translate-y-1/2 truncate text-[13px] font-semibold leading-[18px] text-muted-foreground"
          style={{ top: branchTops[b.id] }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

interface InteractiveNodeShellProps {
  id: string;
  label: string;
  icon: Icon;
  iconColor: string;
  iconInk?: string;
  width: number;
  branches: ShellBranch[];
  selected?: boolean;
  flashAt?: number | null;
  appearSeq?: number | null;
  hasMissingRequired?: boolean;
  isSimulating?: boolean;
  pinned?: boolean;
  searchMatch?: boolean;
  searchDim?: boolean;
  hideInputHandle?: boolean;
  hideOutputHandle?: boolean;
  defaultOutputRequired?: boolean;
  glance?: ReactNode;
  summary?: NodeSummary | null;
  choiceNode?: boolean;
  children: (api: {
    registerRow: (el: HTMLElement | null, id: string) => void;
    choice: NodeChoiceView | null;
  }) => ReactNode;
}

export function InteractiveNodeShell({
  id,
  label,
  icon: IconComp,
  iconColor,
  iconInk = "#ffffff",
  width,
  branches: declaredBranches,
  selected,
  flashAt = null,
  appearSeq = null,
  hasMissingRequired,
  isSimulating,
  pinned = false,
  searchMatch,
  searchDim,
  hideInputHandle,
  hideOutputHandle,
  defaultOutputRequired = true,
  glance,
  summary = null,
  choiceNode = false,
  children,
}: InteractiveNodeShellProps) {
  const branches = useMissingOutputs(id, declaredBranches);
  const updateNodeInternals = useBatchedNodeInternals();
  const runMark = useRunNodeMark(id);
  const choice = useNodeChoiceStats(id, choiceNode);
  const debugFlags = useNodeDebugFlags(id);
  const paused = hasDebugFlag(debugFlags, NODE_PAUSED);
  const simulating = Boolean(isSimulating) || hasDebugFlag(debugFlags, NODE_ACTIVE);
  const branchSig = branches.map((b) => b.id).join("|");

  const rootRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef<Map<string, HTMLElement>>(new Map());
  const [tops, setTops] = useState<Record<string, number>>({});

  const { tier, measuredHeight, measuredHandles } = useNodeDetail(id);
  const compactTops =
    tier !== "full" && measuredHeight
      ? handleCenters(
          branches.map((b) => b.id),
          measuredHandles,
        )
      : null;
  const compact = compactTops !== null;
  const handleTops = compactTops ?? tops;

  const registerRow = useCallback((el: HTMLElement | null, rid: string) => {
    if (el) rowEls.current.set(rid, el);
    else rowEls.current.delete(rid);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || compact) return;
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
  }, [branchSig, selected, compact]);

  useEffect(() => {
    if (!compact) updateNodeInternals(id);
  }, [id, tops, compact, updateNodeInternals]);

  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (flashAt == null) return;
    setFlashing(true);
    const tid = setTimeout(() => setFlashing(false), 2300);
    return () => clearTimeout(tid);
  }, [flashAt]);

  const hasBranches = declaredBranches.length > 0;

  const cardClass = (depth: string) =>
    cn(
      "relative overflow-hidden rounded-lg border border-border bg-card transition-[border-color,box-shadow,opacity]",
      depth,
      !selected && "hover:border-control-edge",
      selected &&
        "border-primary ring-2 ring-primary/30 shadow-lg",
      simulating &&
        !paused &&
        "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg animate-pulse",
      searchMatch &&
        "ring-[3px] ring-warning ring-offset-2 ring-offset-background shadow-lg shadow-warning/30",
      runMark === "executed" && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      runMark === "failed" && "ring-[3px] ring-destructive ring-offset-2 ring-offset-background shadow-lg",
      paused && "ring-[3px] ring-warning ring-offset-2 ring-offset-background shadow-lg",
    );

  const header = (
    <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5">
      <div
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[--radius] shadow-sm"
        style={{ backgroundColor: iconColor }}
      >
        <IconComp size={11} weight="fill" style={{ color: iconInk }} />
      </div>
      <span className="min-w-0 flex-auto truncate text-2xs font-semibold text-foreground">
        {label}
      </span>
      {Boolean(hasMissingRequired) && (
        <Warning size={12} weight="fill" className="shrink-0 text-warning-ink" />
      )}
      {pinned && (
        <span title="Saída fixada" aria-label="Saída fixada" className="inline-flex shrink-0">
          <PushPin size={11} weight="fill" className="text-primary-ink" />
        </span>
      )}
      <span className="pointer-events-none min-w-0 max-w-[4.5rem] shrink-[4] truncate font-mono text-2xs font-medium text-muted-foreground">
        {id}
      </span>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative transition-opacity duration-200",
        (searchDim || (runMark === "untouched" && !paused)) && "opacity-30",
      )}
      data-run-mark={runMark ?? undefined}
      data-debug-flags={debugFlags || undefined}
      style={compact ? { width, height: measuredHeight } : { width }}
    >
      {!hideInputHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(HANDLE_PAD_CLASS, "!-left-[5px] !border-control-edge")}
        />
      )}

      {hasDebugFlag(debugFlags, NODE_BREAKPOINT) && (
        <span
          role="img"
          aria-label="Ponto de parada"
          title="Ponto de parada"
          className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 h-3 w-3 rounded-full bg-destructive ring-2 ring-background"
        />
      )}
      {hasDebugFlag(debugFlags, NODE_REAL_CALL) && (
        <span className="pointer-events-none absolute -top-6 right-0 z-10 inline-flex items-center gap-1 rounded-[--radius] border border-border bg-card px-1.5 py-0.5 text-2xs font-medium text-foreground shadow-sm">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
          chamada real
        </span>
      )}

      {compact && tier !== "full" && measuredHeight ? (
        <CompactNodeCard
          tier={tier}
          className={cardClass("h-full shadow-sm")}
          icon={IconComp}
          iconColor={iconColor}
          iconInk={iconInk}
          label={label}
          warning={Boolean(hasMissingRequired)}
          pinned={pinned}
          glance={glance}
          summary={summary}
          branches={branches}
          branchTops={handleTops}
          height={measuredHeight}
          choice={choice}
        />
      ) : (
        <motion.div
          initial={appearSeq != null ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{
            delay: (appearSeq ?? 0) * 0.07,
            duration: 0.3,
            ease: "easeOut",
          }}
          className={cardClass("shadow-md")}
        >
          {flashing && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-muted ring-2 ring-inset ring-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.2, times: [0, 0.08, 0.65, 1], ease: "easeOut" }}
            />
          )}

          {header}

          {choice && <NodeChoiceLine view={choice} size="full" />}

          {children({ registerRow, choice })}

          <MissingOutputRows branches={branches} registerRow={registerRow} />
        </motion.div>
      )}

      {!hasBranches && !hideOutputHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className={cn(HANDLE_PAD_CLASS, "!-right-[5px] !border-control-edge")}
        >
          {defaultOutputRequired && <RequiredHandleMarker />}
        </Handle>
      )}
      {branches.map((b) => {
        const top = handleTops[b.id];
        if (top == null) return null;
        return (
          <Handle
            key={b.id}
            type="source"
            position={Position.Right}
            id={b.id}
            title={b.missing ? MISSING_OUTPUT_TITLE : undefined}
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
      })}
    </div>
  );
}
