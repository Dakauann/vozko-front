"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { ReactNode } from "react";

interface TooltipWrapperProps {
  children: ReactNode;
  content: string;
  enabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}

export default function TooltipWrapper({
  children,
  content,
  enabled = true,
  side = "top",
  delayDuration = 200,
}: TooltipWrapperProps) {
  if (!enabled) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap in span so disabled buttons still receive pointer events for the tooltip */}
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side}>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
