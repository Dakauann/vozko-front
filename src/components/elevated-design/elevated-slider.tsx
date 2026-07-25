"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

import { ReactNode, forwardRef, useState } from "react";
import {
  softHoverShadow,
  softSurfaceShadow,
  softSurfaceWithInset,
} from "./shadow-presets";

import { cn } from "@/lib/utils";

type ElevatedSliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  label?: string;
  icon?: ReactNode;
  showValue?: boolean;
  valueSuffix?: string;
  valuePrefix?: string;
  description?: string;
  className?: string;
};

const ElevatedSlider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  ElevatedSliderProps
>(
  (
    {
      label,
      icon,
      showValue = true,
      valueSuffix = "",
      valuePrefix = "",
      description,
      className,
      value,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = useState(false);
    const displayValue = Array.isArray(value) ? value[0] : value;

    const containerShadow = props.disabled
      ? softSurfaceShadow
      : focused
      ? softHoverShadow
      : softSurfaceWithInset;

    const thumbShadow = props.disabled ? softSurfaceShadow : softHoverShadow;

    return (
      <div className={cn("space-y-3", className)}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon && (
                <span
                  className={cn(
                    "text-muted-foreground",
                    props.disabled && "text-muted-foreground"
                  )}
                >
                  {icon}
                </span>
              )}
              {label && (
                <label
                  className={cn(
                    "text-sm font-medium text-foreground",
                    props.disabled && "text-muted-foreground"
                  )}
                >
                  {label}
                </label>
              )}
            </div>

            {showValue && displayValue !== undefined && (
              <span
                className={cn(
                  "text-sm font-medium text-muted-foreground",
                  props.disabled && "text-muted-foreground"
                )}
              >
                {valuePrefix}
                {displayValue}
                {valueSuffix}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "relative rounded-2xl border border-border/60 bg-card/70 p-4 transition-all duration-200",
            "supports-[backdrop-filter]:bg-card/40 supports-[backdrop-filter]:backdrop-blur-xl",
            focused && "border-foreground/20",
            props.disabled &&
              "opacity-60 bg-muted/70 supports-[backdrop-filter]:bg-muted/60"
          )}
          style={{ boxShadow: containerShadow }}
        >
          <SliderPrimitive.Root
            ref={ref}
            className={cn(
              "relative flex w-full touch-none select-none items-center",
              className
            )}
            value={value}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
          >
            <SliderPrimitive.Track
              className={cn(
                "relative h-2 w-full grow overflow-hidden rounded-full",
                props.disabled ? "bg-muted" : "bg-border"
              )}
            >
              <SliderPrimitive.Range
                className={cn(
                  "absolute h-full transition-all duration-200",
                  props.disabled ? "bg-gray-400" : "bg-foreground"
                )}
              />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className={cn(
                "block h-5 w-5 rounded-full border-2 bg-card ring-offset-background transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                "hover:bg-muted",
                props.disabled ? "border-foreground/30" : "border-gray-900"
              )}
              style={{ boxShadow: thumbShadow }}
            />
          </SliderPrimitive.Root>
        </div>

        {description && (
          <p className="px-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }
);

ElevatedSlider.displayName = SliderPrimitive.Root.displayName;

export { ElevatedSlider };
export default ElevatedSlider;
