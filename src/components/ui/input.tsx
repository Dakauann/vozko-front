import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Text fields.
 *
 * A field is a sheet, not a recess. The outgoing identity sank it into the
 * panel — `bg-muted` under a darker top edge — because its whole depth model
 * was inverted. Here the field is the same white as the surface around it and
 * the hairline is what bounds it.
 *
 * Focus is the fusion detail worth pointing at. One reference system marks a
 * focused field with a 2px brand rule along its bottom edge and nothing else;
 * the other marks it with a soft halo and no underline. This does both — and
 * draws the underline as an INSET SHADOW rather than a border, so there is no
 * layout shift and no extra DOM. The two compose because Tailwind renders ring
 * and shadow through separate custom properties.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-[--radius] border border-border-strong bg-card px-2.5 text-sm text-foreground",
          "transition-[border-color,box-shadow] duration-150",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
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
  },
);
Input.displayName = "Input";

export { Input };
