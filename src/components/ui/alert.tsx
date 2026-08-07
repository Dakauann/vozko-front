import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * An alert is the `.notice` recipe: one opaque quiet ground for every variant,
 * with the hue spent on the glyph and the title. The destructive variant used
 * to tint its border, its body copy AND its glyph the same red at three
 * strengths, which put the fill value of --destructive on 13px prose and left
 * the ground translucent enough to change colour with whatever it sat on.
 */
const alertVariants = cva(
  "notice relative w-full px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-[color:var(--notice-ink)] [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "",
        destructive: "notice-fault",
        warning: "notice-warning",
        healthy: "notice-healthy",
        info: "notice-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      // The title is the line that names the problem, so it is where the hue
      // still earns its place. Body copy below stays neutral — it is prose.
      "notice-ink mb-1 font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
