import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // A sunk field: the value sits in a recess in the panel. Focus is
          // --ring, a different hue from the lamp, so a focused field is never
          // read as a field in an accent state.
          "flex h-8 w-full rounded-[--radius] border border-border border-t-rule-strong bg-muted px-2.5 text-[13px] text-foreground transition-colors",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "hover:border-rule-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-rule-strong",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
