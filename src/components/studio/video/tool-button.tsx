"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const TOOLTIP_CLASS = "border border-border-strong bg-popover px-2 py-1 text-2xs text-popover-foreground shadow-md";

interface ToolButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  pressed?: boolean;
  showLabel?: boolean;
  shortcut?: string;
  size?: "sm" | "md";
}

export const ToolButton = forwardRef<HTMLButtonElement, ToolButtonProps>(function ToolButton(
  { label, icon, pressed, showLabel = false, shortcut, size = "md", className, type = "button", ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      data-dense
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[--radius] text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-6 min-w-6 px-1" : "h-7 min-w-7 px-1.5",
        pressed ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className={TOOLTIP_CLASS}>
        <span>{label}</span>
        {shortcut ? <kbd className="ml-2 font-sans text-muted-foreground">{shortcut}</kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
});

export function ToolDivider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />;
}
