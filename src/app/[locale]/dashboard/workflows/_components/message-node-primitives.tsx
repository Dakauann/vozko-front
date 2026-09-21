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


export const WA_CHAT_BG = "bg-[#efeae2] dark:bg-[#0b141a]";
export const WA_BUBBLE_BG = "bg-[#d9fdd3] dark:bg-[#005c4b]";
export const WA_BUBBLE_TEXT = "text-[#111b21] dark:text-[#e9edef]";
export const WA_BUBBLE_MUTED = "text-[#4a7663] dark:text-[#9ec4b6]";
export const WA_SURFACE_BG = "bg-white dark:bg-[#233138]";
export const WA_MUTED_TEXT = "text-[#667781] dark:text-[#8696a0]";
export const WA_ACTION_TEXT = "text-[#008069] dark:text-[#00a884]";
export const WA_DIVIDER = "border-black/[0.06] dark:border-white/10";

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

export interface ShellBranch {
  id: string;
  dot?: string;
  required?: boolean;
}

const HANDLE_PAD_CLASS =
  "!h-[9px] !w-[9px] !rounded-[2px] !border-2 !bg-card " +
  "hover:!border-primary [&.connectingfrom]:!border-primary " +
  "[&.connectingto]:!border-primary [&.valid]:!border-primary [&.valid]:!bg-primary";

export function branchDotClass(id: string): string {
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

export interface InteractiveNodeShellProps {
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
  searchMatch?: boolean;
  searchDim?: boolean;
  hideInputHandle?: boolean;
  hideOutputHandle?: boolean;
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
          className={cn(HANDLE_PAD_CLASS, "!-left-[5px] !border-control-edge")}
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
          !selected && "hover:border-control-edge",
          selected &&
            "border-primary ring-2 ring-primary/30 shadow-lg",
          Boolean(isSimulating) &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg animate-pulse",
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

        {
}
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
              className={cn(HANDLE_PAD_CLASS, "!-right-[5px] !border-control-edge")}
            >
              {defaultOutputRequired && <RequiredHandleMarker />}
            </Handle>
          )}
    </div>
  );
}
