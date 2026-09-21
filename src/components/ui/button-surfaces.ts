import { cn } from "@/lib/utils";


export const BUTTON_PRIMARY = cn(
  "bg-primary text-primary-foreground shadow-button-primary",
  "hover:bg-[hsl(var(--primary-hover))] hover:shadow-button-primary-hover",
  "active:bg-[hsl(var(--primary-active))] active:shadow-button-primary",
);

export const BUTTON_SECONDARY = cn(
  "bg-card text-foreground shadow-quiet",
  "hover:shadow-quiet-hover",
  "active:bg-muted active:shadow-quiet",
);

export const BUTTON_OUTLINE = cn(
  "border border-control-edge bg-card text-foreground dark:bg-muted",
  "hover:border-[hsl(var(--muted-foreground)/0.5)] hover:bg-muted dark:hover:bg-[hsl(var(--accent-hover))]",
  "active:bg-[hsl(var(--accent-hover))] dark:active:bg-card",
);

export const BUTTON_OUTLINE_SUBTLE = cn(
  "border border-control-edge bg-transparent text-foreground",
  "hover:border-[hsl(var(--muted-foreground)/0.5)] hover:bg-muted",
  "active:bg-[hsl(var(--accent-hover))]",
);

export const BUTTON_DESTRUCTIVE = cn(
  "bg-destructive text-destructive-foreground shadow-button",
  "hover:brightness-95 hover:shadow-button-hover",
  "active:brightness-90 active:shadow-button",
);

export const BUTTON_GHOST = cn(
  "bg-transparent text-muted-foreground",
  "hover:bg-muted hover:text-foreground",
  "active:bg-[hsl(var(--accent-hover))]",
);
