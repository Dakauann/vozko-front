"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 border-foreground/20 rounded-sm border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    style={{
      boxShadow:
        "0px 0.7066px 0.7066px -0.6667px rgba(0,0,0,0.08), 0px 1.8066px 1.8066px -1.3333px rgba(0,0,0,0.08), 0px 3.6218px 3.6218px -2px rgba(0,0,0,0.07), 0px 6.8656px 6.8656px -2.6667px rgba(0,0,0,0.07), 0px 13.6468px 13.6468px -3.3333px rgba(0,0,0,0.05), 0px 30px 30px -4px rgba(0,0,0,0.02), inset 0px 3px 1px 0px var(--shadow-highlight-strong)",
    }}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check weight="bold" className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
