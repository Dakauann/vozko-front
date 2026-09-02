"use client";

import * as SelectPrimitive from "@radix-ui/react-select";

import { CaretDown, CaretUp, Check } from "@/components/icons";
import { ReactNode, forwardRef, useCallback, useState } from "react";

import { cn } from "@/lib/utils";

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

    // The trigger floats its label once it holds a value, is open, or has
    // focus. A Radix trigger is a button, so it has no :placeholder-shown for
    // the CSS mechanism in elevated-input to read — this one stays driven by
    // state, which is why `focused` survives here and was deleted there.
    // A VALUE lifts the label, the same rule the input follows — not focus,
    // and not the menu being open. While it rests it owns the value slot, so
    // the trigger's own placeholder has to stand down or the two collide.
    const labelFloating = effectiveHasValue;
    const isFloating = Boolean(label);

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
                "relative z-[200] max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border-strong bg-card text-foreground shadow-lg",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                contentClassName,
              )}
              position="popper"
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                <CaretUp className="h-4 w-4" weight="bold" />
              </SelectPrimitive.ScrollUpButton>

              {/*
                p-1, matching ElevatedSelectContent below — this viewport was
                the only one without it.

                An item is a rounded-[--radius] block; the panel is rounded-lg
                with a border. Edge to edge, the item's corners sit inside the
                panel's squarer ones and the highlight reads as a stray rounded
                rectangle stamped on the list — and two adjacent items look like
                they have a seam between them, because each is drawing its own
                rounded shape with nothing between. The 4px inset is what makes
                the rounding read as one list instead of stacked cards.
              */}
              <SelectPrimitive.Viewport className="p-1">
                {children}
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                <CaretDown className="h-4 w-4" weight="bold" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      );
    }

    return (
      <div
        className={cn("w-full", className)}
        style={
          {
            "--field-label-top": "0.25rem",
            "--field-label-left": icon ? "2.25rem" : "0.75rem",
          } as React.CSSProperties
        }
      >
        <div className="relative w-full">
        {icon && (
          // A resting control is not commit, selection or focus, so its icon
          // carries no brand ink — this was text-primary-ink/60, which spent
          // the accent on a control doing nothing.
          <span
            className={cn(
              "pointer-events-none absolute z-[1] flex items-center text-muted-foreground",
              isFloating ? "top-1/2 -translate-y-1/2" : "inset-y-0",
              "left-2.5",
            )}
          >
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
              "flex w-full items-center justify-between gap-3 rounded-[--radius] border border-control-edge bg-card px-3 text-sm font-medium text-foreground dark:bg-muted",
              "transition-[background-color,border-color,box-shadow] duration-150",
              "hover:border-[hsl(var(--muted-foreground)/0.5)]",
              // Same focus as every other field: the border, the 2px brand
              // underline and the halo. The ground does not move — see
              // elevated-input. Open counts as focus here; the menu is the
              // control's active state.
              "focus-visible:outline-none focus-visible:border-control-edge focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary-edge))] focus-visible:ring-2 focus-visible:ring-primary/15",
              "data-[state=open]:border-control-edge data-[state=open]:shadow-[inset_0_-2px_0_0_hsl(var(--primary-edge))]",
              "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60",
              // Matches the input's default floating step exactly — 44px, with
              // the value on a 16px line so the risen label clears it.
              isFloating
                ? "h-11 pb-[5px] pt-[21px] leading-4"
                : "h-9 py-2",
              icon && "pl-9",
              !icon && "pl-3",
            )}
          >
            <SelectPrimitive.Value
              placeholder={isFloating && !labelFloating ? "" : placeholder}
            />
            <SelectPrimitive.Icon asChild>
              <CaretDown className="h-4 w-4 opacity-50" weight="bold" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          {/* A Radix trigger is a button, so there is no :placeholder-shown for
              the CSS in globals.css to read — this label is positioned by
              state instead. Only the built-in trigger gets one; a caller
              supplying its own `trigger` owns its own labelling. */}
          {isFloating ? (
            <label
              className={cn(
                "field-label",
                !labelFloating && "field-label-rest",
                labelFloating && (open || focused) && "field-label-active",
              )}
            >
              {label}
            </label>
          ) : null}

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                "relative z-[200] max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border-strong bg-card text-foreground shadow-lg",
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
        // border-l-primary set a border COLOUR on an element Tailwind's
        // preflight gives border-width 0 — two classes that painted nothing.
        // A coloured left stripe is a banned device here anyway.
        //
        // The ground moves off --muted because --muted IS --popover in dark,
        // so the highlight measured 1.00:1 against its own panel. The label
        // stays --foreground and the green stays in the check: hover is not
        // one of the accent's three jobs, and on the deeper ground
        // --primary-ink falls to 4.13:1 in light.
        "hover:bg-[hsl(var(--accent-hover))] hover:text-foreground",
        "focus:bg-[hsl(var(--accent-hover))] focus:text-foreground",
        "data-[state=checked]:bg-[hsl(var(--accent-hover))] data-[state=checked]:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        // (rounded-[--radius] is already on the base line above; the duplicate
        // that sat here did nothing but suggest the two were different.)
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
