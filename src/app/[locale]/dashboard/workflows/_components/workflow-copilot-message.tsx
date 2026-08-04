"use client";

import { memo, useState } from "react";
import { Brain, CaretDown, CaretRight, Robot, User, Wrench } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface CopilotMessageProps {
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  ok?: boolean;
  streaming?: boolean;
}

// CopilotThinking renders the model's live chain-of-thought as a dimmed, italic,
// collapsible block (Claude-Code style), visually distinct from the answer.
export const CopilotThinking = memo(function CopilotThinking({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="text-[11px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 italic text-muted-foreground/80 hover:text-muted-foreground"
      >
        <Brain size={12} weight="duotone" className="shrink-0" />
        <span>{streaming ? "Pensando…" : "Raciocínio"}</span>
        {open ? <CaretDown size={10} /> : <CaretRight size={10} />}
      </button>
      {open && (
        <div className="mt-0.5 ml-1 border-l-2 border-border pl-2 italic whitespace-pre-wrap text-muted-foreground/70">
          {text}
          {streaming && (
            <span className="ml-0.5 inline-block w-1 h-3 align-middle bg-muted-foreground/50 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
});

export const CopilotMessage = memo(function CopilotMessage({
  role,
  text,
  ok,
  streaming,
}: CopilotMessageProps) {
  if (role === "tool") {
    return (
      <div className="flex gap-1.5 items-start text-[11px] pl-1">
        <Wrench
          size={12}
          weight="fill"
          className={cn("mt-0.5 shrink-0", ok === false ? "text-red-500" : "text-sky-500")}
        />
        <span
          className={cn(
            "font-mono break-words",
            ok === false ? "text-red-500" : "text-muted-foreground",
          )}
        >
          {text}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2 text-xs", role === "user" && "justify-end")}>
      {role === "assistant" && (
        <Robot size={14} className="mt-0.5 shrink-0 text-lamp-ink" />
      )}
      <div
        className={cn(
          "rounded-md px-2 py-1 max-w-[85%] whitespace-pre-wrap",
          role === "user" && "bg-muted",
          role === "assistant" && "bg-muted",
          role === "system" && "italic text-muted-foreground",
        )}
      >
        {text}
        {streaming && (
          <span className="ml-0.5 inline-block w-1.5 h-3 align-middle bg-primary animate-pulse" />
        )}
      </div>
      {role === "user" && (
        <User size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
});
