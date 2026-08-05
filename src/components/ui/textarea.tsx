import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Same grammar as ui/input.tsx: a sheet rather than a recess, and a
        // focus state that carries both the brand underline and the halo.
        "flex min-h-[80px] w-full rounded-[--radius] border border-border-strong bg-card px-2.5 py-2 text-sm text-foreground",
        "transition-[border-color,box-shadow] duration-150",
        "placeholder:text-muted-foreground",
        "hover:border-[hsl(var(--muted-foreground)/0.5)]",
        "focus-visible:outline-none focus-visible:border-border-strong",
        "focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]",
        "focus-visible:ring-2 focus-visible:ring-primary/15",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/15",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
