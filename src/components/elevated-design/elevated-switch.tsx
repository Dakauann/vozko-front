"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";

import { ReactNode, forwardRef } from "react";
import { softSurfaceShadow, softSurfaceWithInset } from "./shadow-presets";

import { cn } from "@/lib/utils";

type ElevatedSwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive.Root
> & {
  label?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

const ElevatedSwitch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  ElevatedSwitchProps
>(({ label, description, icon, className, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className={`${props.disabled ? "text-muted-foreground" : "text-muted-foreground"}`}
          >
            {icon}
          </span>
        )}

        <SwitchPrimitive.Root
          ref={ref}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-foreground data-[state=unchecked]:bg-border",
            props.disabled &&
              "data-[state=checked]:bg-gray-500 data-[state=unchecked]:bg-muted",
            className
          )}
          style={{
            boxShadow: props.disabled
              ? `${softSurfaceShadow}, inset 0 1px 0 var(--shadow-highlight)`
              : softSurfaceWithInset,
          }}
          {...props}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-card shadow-lg ring-0 transition-transform",
              "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
            )}
            style={{
              boxShadow: props.disabled
                ? "0 1px 2px rgba(0, 0, 0, 0.1)"
                : "0 1px 3px rgba(0, 0, 0, 0.2)",
            }}
          />
        </SwitchPrimitive.Root>

        {label && (
          <label
            className={`text-sm font-medium cursor-pointer ${
              props.disabled ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {label}
          </label>
        )}
      </div>

      {description && (
        <p
          className={`text-sm px-1 ${
            props.disabled ? "text-muted-foreground" : "text-muted-foreground"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
});

ElevatedSwitch.displayName = SwitchPrimitive.Root.displayName;

export { ElevatedSwitch };
export default ElevatedSwitch;
