"use client";

/**
 * AiHandlerChip, shows which AI attends a conversation: a direct agent ("IA · <nome>")
 * or a workflow ("Fluxo · <nome>"), with a distinct muted "pausada" state when the AI is
 * turned off for the conversation. Follows the house Solid-Symbol rule (a solid opaque
 * accent tile with a white glyph), one Signal-Blue voice, no tint-behind-glyph.
 *
 * Used compact (size="sm") in the inbox list row and larger (size="md") in the chat
 * header. The workflow variant is a button that opens the read-only run viewer.
 */

import { Robot, FlowArrow } from "@/components/icons";

import type { AIHandler } from "@/lib/conversations/types";
import {
  isAiAutoReplyEnabled,
  isAiCurrentlyAttending,
} from "@/lib/conversations/attendance-summary";
import { cn } from "@/lib/utils";

interface AiHandlerChipProps {
  handler?: AIHandler | null;
  /** Per-conversation AI on/off (backend `automation_enabled`; null → on). */
  automationEnabled?: boolean | null;
  conversationStatus?: string | null;
  assignedUserId?: string | null;
  size?: "sm" | "md";
  /** Opens the read-only workflow-run viewer. When set, the workflow chip is a button. */
  onOpenWorkflow?: (handler: AIHandler) => void;
  className?: string;
}

const SIZES = {
  sm: {
    chip: "gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-2xs",
    tile: "h-4 w-4 rounded-[5px]",
    glyph: "h-2.5 w-2.5",
    dot: "h-1 w-1",
  },
  md: {
    chip: "gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs",
    tile: "h-5 w-5 rounded-md",
    glyph: "h-3 w-3",
    dot: "h-1.5 w-1.5",
  },
} as const;

export function AiHandlerChip({
  handler,
  automationEnabled,
  conversationStatus,
  assignedUserId,
  size = "sm",
  onOpenWorkflow,
  className,
}: AiHandlerChipProps) {
  // A human actively owning the thread attends it, not the AI; finished chats hide it.
  const assignee = String(assignedUserId ?? "").trim();
  const humanOwns = assignee.length > 0 && !assignee.startsWith("ai:");
  if (conversationStatus === "finished" || humanOwns) return null;

  // Prefer the resolved handler; fall back to a generic "IA" chip when handler data is
  // absent (older payloads) but the AI is still attending, so nothing regresses.
  const resolved: AIHandler | null =
    handler && (handler.kind === "agent" || handler.kind === "workflow")
      ? handler
      : isAiCurrentlyAttending({
            automationEnabled,
            conversationStatus,
            assignedUserId,
          })
        ? { kind: "agent" }
        : null;
  if (!resolved) return null;

  const paused = !isAiAutoReplyEnabled(automationEnabled);
  const isWorkflow = resolved.kind === "workflow";
  const running = isWorkflow && resolved.run_status === "running";
  const s = SIZES[size];

  const name = isWorkflow
    ? resolved.workflow_name?.trim() || "Fluxo"
    : resolved.agent_name?.trim() || "Agente";
  const prefix = isWorkflow ? "Fluxo" : "IA";
  const Glyph = isWorkflow ? FlowArrow : Robot;

  const clickable = isWorkflow && !!onOpenWorkflow && !!resolved.workflow_id;

  const title = paused
    ? `${prefix} pausada, ${name}`
    : isWorkflow
      ? `Fluxo: ${name}${resolved.current_node_type ? ` · ${resolved.current_node_type}` : ""}`
      : `Atendimento por IA: ${name}`;

  const El = clickable ? "button" : "span";

  return (
    <El
      type={clickable ? "button" : undefined}
      onClick={
        clickable
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onOpenWorkflow?.(resolved);
            }
          : undefined
      }
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex max-w-full items-center border font-medium transition-colors",
        s.chip,
        paused
          ? "border-border bg-muted text-muted-foreground"
          : "border-border bg-card text-foreground shadow-sm",
        clickable &&
          "cursor-pointer hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        className={cn(
          "flex flex-shrink-0 items-center justify-center",
          s.tile,
          paused ? "bg-muted dark:bg-muted" : "bg-primary",
        )}
      >
        <Glyph className={cn(s.glyph, "text-white")} weight="fill" />
      </span>
      <span className="min-w-0 truncate">
        <span className={cn(!paused && "text-muted-foreground")}>{prefix} · </span>
        {name}
      </span>
      {running && !paused && (
        <span className="relative flex flex-shrink-0" aria-hidden>
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60",
              s.dot,
            )}
          />
          <span className={cn("relative inline-flex rounded-full bg-primary", s.dot)} />
        </span>
      )}
      {paused && <span className="flex-shrink-0 opacity-70">· pausada</span>}
    </El>
  );
}
