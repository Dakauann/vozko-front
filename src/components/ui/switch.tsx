"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Checked is the brand fill; unchecked is a neutral track that is dark
      // enough to read as a track rather than as an empty gap. `--input` was
      // the same value as the hairline, which made an off switch nearly
      // invisible on a white sheet.
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-[hsl(var(--muted-foreground)/0.42)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // The thumb keeps a real drop shadow: it is the one part of a switch
        // that genuinely sits above its track.
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_hsl(228_40%_28%/0.28)] ring-0 transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
