"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CaretDown, CheckCircle, Wrench } from "@/components/icons";
import { arrivalTransition, panelSettleTransition } from "@/lib/motion/tokens";
import type { ThreadRow } from "@/lib/conversations/thread-rows";
import { isToolMessage, toolEventInfo, type ToolEventInfo } from "@/lib/conversations/tool-events";
import { cn } from "@/lib/utils";

import { MessageTime } from "./message-parts";
import { useThreadRow } from "./thread-context";

function ToolEventChip({
  info,
  createdAt,
  hasResultBelow,
  isMatched,
  isCurrentMatch,
}: {
  info: ToolEventInfo;
  createdAt: string;
  hasResultBelow: boolean;
  isMatched: boolean;
  isCurrentMatch: boolean;
}) {
  const isResult = info.kind === "result";
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(info.detail);

  return (
    <div className="flex w-full flex-col items-center px-4 py-0.5">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        title={info.raw}
        aria-expanded={expanded}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2",
          "ring-1 ring-inset ring-warning/20 transition-colors",
          hasDetail ? "cursor-pointer hover:bg-muted" : "cursor-default",
          isMatched && "ring-2 ring-warning ring-offset-1",
          isCurrentMatch && "ring-2 ring-healthy ring-offset-2",
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ink-3">
          {isResult ? <CheckCircle weight="fill" className="h-2.5 w-2.5" /> : <Wrench weight="bold" className="h-2.5 w-2.5" />}
        </span>
        <span className="min-w-0 max-w-[220px] truncate text-2xs font-medium leading-none text-foreground">{info.title}</span>
        <span className="shrink-0 text-2xs tabular-nums leading-none text-muted-foreground">
          <MessageTime iso={createdAt} />
        </span>
        {hasDetail && (
          <CaretDown
            weight="bold"
            className={cn("h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && hasDetail && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={panelSettleTransition}
            className="mt-1 w-full max-w-[80%] overflow-hidden"
          >
            <div className="rounded-md border border-border bg-muted px-2.5 py-1.5">
              <p className="whitespace-pre-wrap break-words text-2xs leading-snug text-muted-foreground">{info.detail}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {hasResultBelow && (
        <div className="flex h-2 flex-col items-center justify-center" aria-hidden="true">
          <span className="h-full w-px bg-border" />
        </div>
      )}
    </div>
  );
}

export function ToolEventRow({ row }: { row: Extract<ThreadRow, { kind: "tool" }> }) {
  const { toolDefinitions, toolCopy, matchedIds, currentMatchId, arrivalStart } = useThreadRow();
  const { message, previous, next } = row;

  const previousInfo = previous && isToolMessage(previous) ? toolEventInfo(previous, toolDefinitions, toolCopy) : null;
  const info = toolEventInfo(message, toolDefinitions, toolCopy, previousInfo?.toolName);
  if (!info) return null;
  const nextInfo = next && isToolMessage(next) ? toolEventInfo(next, toolDefinitions, toolCopy, info.toolName) : null;

  return (
    <motion.div
      data-msg-id={message.id}
      initial={arrivalStart(message.id)}
      animate={{ opacity: 1 }}
      transition={arrivalTransition}
      className="group/msg flex w-full justify-center"
    >
      <ToolEventChip
        info={info}
        createdAt={message.created_at ?? ""}
        hasResultBelow={info.kind === "call" && nextInfo?.kind === "result"}
        isMatched={matchedIds.has(message.id)}
        isCurrentMatch={currentMatchId === message.id}
      />
    </motion.div>
  );
}
