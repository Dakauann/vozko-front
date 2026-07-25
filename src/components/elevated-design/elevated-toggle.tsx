"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";

import { ReactNode, forwardRef } from "react";

import { cn } from "@/lib/utils";
import { softSurfaceWithInset } from "./shadow-presets";

type ElevatedToggleProps = React.ComponentPropsWithoutRef<
  typeof TogglePrimitive.Root
> & {
  label?: string;
  icon?: ReactNode;
  checkedIcon?: ReactNode;
  description?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
};

const ElevatedToggle = forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  ElevatedToggleProps
>(
  ({
    label,
    icon,
    checkedIcon,
    description,
    className,
    variant = "default",
    size = "default",
    children,
    ...props
  }) => {
    const sizeClasses = {
      default: "h-10 px-3",
      sm: "h-9 px-2.5",
      lg: "h-11 px-8",
    };

    const variantClasses = {
      default: cn(
        "bg-transparent border border-border/60 text-foreground",
        "hover:bg-muted",
        "data-[state=on]:bg-foreground data-[state=on]:text-white data-[state=on]:border-gray-900"
      ),
      outline: cn(
        "border border-border bg-transparent text-foreground",
        "hover:bg-muted",
        "data-[state=on]:bg-foreground data-[state=on]:text-white"
      ),
      ghost: cn(
        "bg-transparent text-foreground",
        "hover:bg-muted",
        "data-[state=on]:bg-muted"
      ),
    };

    return (
      <div className="flex flex-col gap-1">
        <TogglePrimitive.Root
          className={cn(
            "inline-flex items-center justify-center rounded-2xl text-sm font-medium ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            sizeClasses[size],
            variantClasses[variant],
            className
          )}
          style={{
            boxShadow: softSurfaceWithInset,
          }}
          {...props}
        >
          {props.pressed && checkedIcon ? checkedIcon : icon}
          {(label || children) && (
            <span className={icon || checkedIcon ? "ml-2" : ""}>
              {label || children}
            </span>
          )}
        </TogglePrimitive.Root>

        {description && (
          <p className="text-sm text-muted-foreground px-1">{description}</p>
        )}
      </div>
    );
  }
);

ElevatedToggle.displayName = TogglePrimitive.Root.displayName;

export { ElevatedToggle };
export default ElevatedToggle;
