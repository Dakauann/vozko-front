"use client";

import * as SelectPrimitive from "@radix-ui/react-select";

import { CaretDown, CaretUp, Check } from "@/components/icons";
import { ReactNode, forwardRef, useCallback, useState } from "react";

import { cn } from "@/lib/utils";

const DISABLED_SHADOW =
  "var(--elev-1)";

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

    // A resting trigger sits on the sheet; only the focus underline uses this slot.
    const boxShadowValue = props.disabled ? DISABLED_SHADOW : "none";

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
      <div className={cn("w-full", className)}>
        {label ? (
          <label className="legend mb-1 block max-w-full truncate">
            {label}
          </label>
        ) : null}
        <div className="relative flex w-full items-center">
        {icon && (
          <span className="pointer-events-none absolute left-5 z-[1] flex h-full items-center text-primary-ink/60">
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
              "flex w-full items-center justify-between gap-3 rounded-[--radius] border border-border-strong bg-card px-3 py-2 text-sm font-medium text-foreground transition-[border-color,box-shadow] duration-150",
              "hover:border-[hsl(var(--muted-foreground)/0.5)]",
              // Same focus as every other field: brand underline plus halo.
              "focus-visible:outline-none focus-visible:border-border-strong focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-primary/15",
              "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60",
              icon && "pl-9",
              !icon && "pl-3",
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

        {/* Static legend above the control — see elevated-input. */}
        </div>
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
        "relative flex w-full cursor-pointer select-none items-center gap-3 rounded-[--radius] px-3 py-2.5 text-sm outline-none transition-colors",
        "hover:bg-muted hover:text-primary-ink hover:border-l-primary",
        "focus:bg-muted focus:text-primary-ink",
        "data-[state=checked]:bg-muted data-[state=checked]:text-primary-ink data-[state=checked]:border-l-primary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "rounded-[--radius]",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon ? (
          iconStyled ? (
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
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
        <Check className="h-4 w-4 flex-shrink-0 text-primary-ink" weight="bold" />
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
      "px-3 py-2 text-xs font-semibold text-muted-foreground",
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
