import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import {
  BUTTON_DESTRUCTIVE,
  BUTTON_GHOST,
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
} from "@/components/ui/button-surfaces";

/**
 * Buttons.
 *
 * The two reference systems solve a button differently and this takes the
 * better half of each.
 *
 * From the first: the STATE RAMP. Rest, hover and pressed are discrete, named
 * steps rather than an opacity fade — `--primary` → `--primary-hover` →
 * `--primary-active` — so a pressed button is a different colour, not a
 * translucent one. Fading a fill's opacity over an unknown ground is how a
 * hover state ends up looking different on every page it appears on.
 *
 * From the second: the MATERIAL. A filled button carries a two-layer drop
 * shadow plus an inset bottom rule (`--elev-button`), which is what makes it
 * read as a key you can press rather than a coloured rectangle, and it lifts
 * one pixel on hover and drops back on press. The quiet variant draws its
 * border AS the first shadow layer (`0 0 0 1px`, inside `--elev-button-quiet`)
 * so border and elevation compose instead of double-drawing an edge.
 *
 * The FILLED variant now draws its edge the same way (`--elev-button-primary`).
 * It has to: across the brand green's whole lightness range no single value
 * carries both a readable label and a 3:1 boundary — at L38 the label measures
 * APCA Lc 58.6 and the fill edge only 2.31:1 on white, which fails WCAG 1.4.11.
 * The fill stays vivid and `--primary-edge` carries the boundary (3.63:1). On
 * graphite the fill is already 9.52:1 against the canvas, so the same token
 * equals the fill there and the ring composes to a no-op.
 *
 * The neutral surfaces (primary, secondary, outline, ghost) live in
 * button-surfaces.ts, shared with elevated-design/button.tsx. Two components is
 * a fair answer to two needs — this one exports `buttonVariants` as a class
 * string for the shadcn primitives; that one is what people render — but two
 * copies of the class strings never was, and they had already drifted.
 *
 * Corners are 6px off a real ramp. The outgoing identity squared everything to
 * 2px because the pill it replaced was the loudest tell of the identity BEFORE
 * that one; 6px is neither, and it is where both references actually sit.
 *
 * Only `primary` and `destructive` carry a fill. A screen with four accent
 * buttons has no primary action left on it.
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius] text-sm font-medium",
    "transition-[background-color,box-shadow,transform,color,border-color] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled is a flat neutral chip: no fill, no elevation, no lift. Leaving
    // the shadow on a disabled button is what keeps it looking pressable.
    "disabled:pointer-events-none disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        primary: BUTTON_PRIMARY,
        destructive: BUTTON_DESTRUCTIVE,
        secondary: BUTTON_SECONDARY,
        outline: BUTTON_OUTLINE,
        ghost: BUTTON_GHOST,
        // The board's "Botão de Texto": accent ink, no box. Ink, not fill —
        // the fill value is tuned for a label to sit ON it, the ink for text
        // on a sheet. Underline arrives on hover so a row of these doesn't
        // read as a paragraph of links.
        link: "text-primary-ink underline-offset-4 hover:underline active:text-primary-active",
      },
      size: {
        // 28 / 32 / 40 — the three heights both references ship.
        sm: "h-7 px-2.5 text-xs",
        default: "h-8 px-3",
        lg: "h-10 px-5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
