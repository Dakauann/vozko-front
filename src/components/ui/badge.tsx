import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A silkscreen chip. Bordered and quiet by default — a page of solid-filled
 * badges competes with the lamp, and the lamp is the only thing here allowed to
 * mean "this one".
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[--radius] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-muted text-lamp-ink",
        secondary: "border-border bg-muted text-muted-foreground",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
        outline: "border-border text-foreground",
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
