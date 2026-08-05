import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A status chip.
 *
 * Borderless tinted fills, not the outlined stencil this used to be. The
 * outgoing version was a bordered 11px uppercase chip tracked at 0.08em — a
 * silkscreen legend on a panel — and a row of them read as machine labelling.
 * Both reference systems draw a status chip the same way instead: a soft tint
 * of the status hue carrying text in the same hue, no border, sentence case.
 * That reads as a state at a glance and stops competing with real controls for
 * attention.
 *
 * Sized to sit on a table row without changing its height.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        // One neutral chip; the STATUS lives in the label's colour and the dot
        // beside it, never in a wash of the label's own hue behind it. That
        // wash-plus-matching-ink pattern is banned in this system: it is the
        // clearest tell of a generated interface, and it makes six states read
        // as six shades of one thing instead of six distinct states.
        default: "bg-muted text-primary-ink",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-muted text-destructive-ink",
        healthy: "bg-muted text-healthy-ink",
        warning: "bg-muted text-warning-ink",
        info: "bg-muted text-info-ink",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
