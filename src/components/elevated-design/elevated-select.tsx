"use client";

import * as SelectPrimitive from "@radix-ui/react-select";

import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { ReactNode, forwardRef, useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import { softSurfaceWithInset } from "./shadow-presets";

const DISABLED_SHADOW =
  "0 12px 24px -20px rgba(15,23,42,0.12), inset 0 1px 0 var(--shadow-highlight)";

type ElevatedSelectProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Root
> & {
  label?: string;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  trigger?: ReactNode;
  contentClassName?: string;
};

const ElevatedSelect = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  ElevatedSelectProps
>(
  (
    {
      label,
      placeholder,
      icon,
      className,
      contentClassName,
      children,
      value,
      onValueChange,
      trigger,
      ...props
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const [open, setOpen] = useState(false);

    const defaultVal = (props as unknown as { defaultValue?: string | null })
      .defaultValue;

    const [hasValue, setHasValue] = useState(() => {
      if (value !== undefined && value !== null) {
        return String(value).length > 0;
      }
      return Boolean(defaultVal ?? "");
    });

    const handleValueChange = useCallback(
      (nextValue: string) => {
        setHasValue(nextValue.length > 0);
        onValueChange?.(nextValue);
      },
      [onValueChange],
    );

    const effectiveHasValue =
      value !== undefined
        ? value !== null && String(value).length > 0
        : hasValue;

    const floatingState = focused || open || effectiveHasValue;

    const boxShadowValue = props.disabled
      ? DISABLED_SHADOW
      : softSurfaceWithInset;

    if (trigger) {
      return (
        <SelectPrimitive.Root
          value={value}
          onValueChange={handleValueChange}
          open={open}
          onOpenChange={setOpen}
          {...props}
        >
          <SelectPrimitive.Trigger
            asChild
            ref={ref}
            className="focus:outline-none focus-visible:outline-none"
          >
            {trigger}
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                "relative z-[200] max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-2xl",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                contentClassName,
              )}
              position="popper"
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                <CaretUp className="h-4 w-4" weight="bold" />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                <CaretDown className="h-4 w-4" weight="bold" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      );
    }

    return (
      <div className={cn("relative flex w-full items-center", className)}>
        {icon && (
          <span className="pointer-events-none absolute left-5 z-[1] flex h-full items-center text-primary/60">
            {icon}
          </span>
        )}

        <SelectPrimitive.Root
          value={value}
          onValueChange={handleValueChange}
          open={open}
          onOpenChange={setOpen}
          {...props}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-all duration-200 ease-out",
              "hover:border-foreground/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60",
              icon && "pl-12",
              !icon && "pl-5",
            )}
            style={{ boxShadow: boxShadowValue }}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <CaretDown className="h-4 w-4 opacity-50" weight="bold" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                "relative z-[200] max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-2xl",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              )}
              position="popper"
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                <CaretUp className="h-4 w-4" weight="bold" />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport className="p-1">
                {children}
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                <CaretDown className="h-4 w-4" weight="bold" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {label ? (
          <label
            className={cn(
              "absolute pointer-events-none rounded-full px-2 py-[2px] text-sm font-medium transition-all duration-200 ease-out",
              icon ? "left-12" : "left-5",
              floatingState
                ? cn(
                    "-ml-1 top-0 -translate-y-1/2 text-[11px] shadow-sm",
                    props.disabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-card text-foreground",
                  )
                : cn(
                    "top-1/2 -translate-y-1/2",
                    props.disabled
                      ? "text-muted-foreground"
                      : "text-muted-foreground",
                  ),
            )}
            style={{ transformOrigin: "left center" }}
          >
            {label}
          </label>
        ) : null}
      </div>
    );
  },
);

ElevatedSelect.displayName = "ElevatedSelect";

const ElevatedSelectItem = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    icon?: ReactNode;
    iconStyled?: boolean;
    description?: string;
    meta?: ReactNode;
  }
>(
  (
    {
      className,
      children,
      icon,
      iconStyled = true,
      description,
      meta,
      ...props
    },
    ref,
  ) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors",
        "hover:bg-primary/10 hover:text-primary hover:border-l-primary",
        "focus:bg-primary/10 focus:text-primary",
        "data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:border-l-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "border-l-4 border-l-transparent rounded-none",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon ? (
          iconStyled ? (
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              {icon}
            </span>
          ) : (
            <span className="flex-shrink-0">{icon}</span>
          )
        ) : null}
        <div className="min-w-0 flex-1">
          <SelectPrimitive.ItemText asChild>
            <span className="truncate font-medium">{children}</span>
          </SelectPrimitive.ItemText>
          {description ? (
            <p className="truncate text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {meta ? (
        <span className="text-xs text-muted-foreground">{meta}</span>
      ) : null}
      <SelectPrimitive.ItemIndicator className="ml-2">
        <Check className="h-4 w-4 flex-shrink-0 text-primary" weight="bold" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  ),
);

ElevatedSelectItem.displayName = SelectPrimitive.Item.displayName;

const ElevatedSelectGroup = SelectPrimitive.Group;
const ElevatedSelectValue = SelectPrimitive.Value;
const ElevatedSelectLabel = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide",
      className,
    )}
    {...props}
  />
));
ElevatedSelectLabel.displayName = SelectPrimitive.Label.displayName;

const ElevatedSelectSeparator = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1.5 h-px bg-border", className)}
    {...props}
  />
));
ElevatedSelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  ElevatedSelect,
  ElevatedSelectGroup,
  ElevatedSelectValue,
  ElevatedSelectItem,
  ElevatedSelectLabel,
  ElevatedSelectSeparator,
};

export default ElevatedSelect;
