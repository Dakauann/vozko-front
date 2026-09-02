"use client";

import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  MutableRefObject,
  ReactNode,
} from "react";
import { forwardRef, useCallback, useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

type BaseVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "vsl"
  | "action"
  | "search";

type LegacyVariant =
  | "main-cta"
  | "secondary-cta"
  | "main-cta-mobile"
  | "secondary-cta-mobile"
  | "vsl-cta";

type TextareaVariant = BaseVariant | LegacyVariant;
type ElevatedTextareaSize = "sm" | "default" | "lg";

type NativeTextareaProps = ComponentPropsWithoutRef<"textarea">;

type ElevatedTextareaProps = NativeTextareaProps & {
  label?: string;
  icon?: ReactNode;
  textareaClassName?: string;
  variant?: TextareaVariant;
  controlSize?: ElevatedTextareaSize;
  autoResize?: boolean;
  maxHeight?: number;
  error?: string;
};

const variantAlias: Record<TextareaVariant, BaseVariant> = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  vsl: "vsl",
  action: "action",
  search: "search",
  "main-cta": "primary",
  "main-cta-mobile": "primary",
  "secondary-cta": "secondary",
  "secondary-cta-mobile": "secondary",
  "vsl-cta": "vsl",
};

/**
 * Two sets of padding, for the same reason as the input: a field carrying a
 * floating label has to leave room for the risen label above the first line of
 * text. A textarea with no label keeps the tighter block.
 */
const floatingSize: Record<ElevatedTextareaSize, string> = {
  sm: "text-sm leading-5 pt-[19px] pb-2",
  default: "text-sm leading-5 pt-[21px] pb-2.5",
  lg: "text-base leading-6 pt-[23px] pb-3",
};

const compactSize: Record<ElevatedTextareaSize, string> = {
  sm: "text-sm py-2.5",
  default: "text-sm py-3.5",
  lg: "text-base py-4",
};

/** Risen position, and — unlike an input — where the label WAITS.
 *
 *  A textarea is tall, so "centred" would drop the label into the middle of an
 *  empty box. It rests at the NATURAL top padding instead — where the first
 *  line would sit in a textarea that reserved no room for a risen label — so an
 *  empty one reads as an ordinary padded textarea. Parking it on the real first
 *  line (11px lower, behind the reserved padding) left it visibly floating. */
const labelTop: Record<ElevatedTextareaSize, string> = {
  sm: "0.1875rem",
  default: "0.25rem",
  lg: "0.375rem",
};

/** The resting label sits ON the first text line: border + padding-top, plus
 *  half the difference between the line box and the label's own 18.2px. */
const labelRest: Record<ElevatedTextareaSize, string> = {
  sm: "0.75rem",
  default: "1rem",
  lg: "1.25rem",
};

const basePadding: Record<ElevatedTextareaSize, string> = {
  sm: "px-3",
  default: "px-3",
  lg: "px-3.5",
};

const iconPadding: Record<ElevatedTextareaSize, string> = {
  sm: "pl-[2.75rem]",
  default: "pl-[3.25rem]",
  lg: "pl-[3.75rem]",
};

const iconPosition: Record<ElevatedTextareaSize, string> = {
  sm: "left-3 top-2.5",
  default: "left-4 top-3.5",
  lg: "left-5 top-4",
};

/** Sheet in light, well in dark — see elevated-input for the reasoning. */
const FIELD = cn(
  "bg-card dark:bg-muted text-foreground border border-control-edge",
  "hover:border-[hsl(var(--muted-foreground)/0.5)]",
  "focus-visible:border-control-edge",
  "focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary-edge))]",
  "focus-visible:ring-2 focus-visible:ring-primary/15",
);

const textareaVariantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  secondary: FIELD,
  outline: FIELD,
  ghost: cn(
    "bg-transparent text-foreground border border-transparent hover:bg-muted",
    "focus-visible:bg-card dark:focus-visible:bg-muted focus-visible:border-control-edge",
    "focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary-edge))]",
    "focus-visible:ring-2 focus-visible:ring-primary/15",
  ),
  vsl: FIELD,
  action:
    "bg-primary text-primary-foreground border border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  search: FIELD,
};

const ERROR_FIELD = cn(
  "border-destructive hover:border-destructive",
  "focus-visible:border-destructive",
  "focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--destructive))]",
  "focus-visible:ring-destructive/15",
);

const disabledClasses =
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted disabled:text-muted-foreground disabled:border-border";

const iconColorByVariant: Record<BaseVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-muted-foreground",
  outline: "text-muted-foreground",
  ghost: "text-muted-foreground",
  vsl: "text-muted-foreground",
  action: "text-primary-foreground",
  search: "text-muted-foreground",
};

const ElevatedTextarea = forwardRef<HTMLTextAreaElement, ElevatedTextareaProps>(
  (
    {
      className,
      textareaClassName,
      id,
      label,
      value,
      onFocus,
      onBlur,
      onChange,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      icon,
      disabled,
      placeholder,
      error,
      rows = 4,
      variant = "secondary",
      controlSize = "default",
      autoResize = false,
      maxHeight = 150,
      ...textareaProps
    },
    ref,
  ) => {
    const fallbackId = useId();
    const textareaId = id ?? fallbackId;
    const errorId = `${textareaId}-error`;
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const floatingLabel = label?.trim() ? label.trim() : undefined;
    const isFloating = Boolean(floatingLabel);
    // See elevated-input: the label rides :placeholder-shown, so a floating
    // field always carries a placeholder even when it has no hint to give.
    const nativePlaceholder = isFloating ? (placeholder ?? " ") : placeholder;

    const combinedRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        textareaRef.current = el;
        if (!ref) return;
        try {
          if (typeof ref === "function") {
            ref(el);
          } else {
            (ref as MutableRefObject<HTMLTextAreaElement | null>).current = el;
          }
        } catch {}
      },
      [ref],
    );

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea && autoResize) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
      }
    }, [autoResize, maxHeight]);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event);
      adjustHeight();
    };

    const resolvedVariant = variantAlias[variant] ?? "secondary";
    const resolvedSize: ElevatedTextareaSize = controlSize ?? "default";
    const isField =
      resolvedVariant !== "primary" && resolvedVariant !== "action";

    const fieldVars = {
      "--field-label-top": labelTop[resolvedSize],
      "--field-label-rest": labelRest[resolvedSize],
      "--field-label-rest-transform": "none",
      "--field-label-left": icon ? "3.25rem" : "0.75rem",
    } as CSSProperties;

    return (
      <div className={cn("w-full", className)} style={fieldVars}>
        <div className="relative w-full">
          {icon ? (
            <span
              className={cn(
                "pointer-events-none absolute z-[1] flex items-center",
                iconPosition[resolvedSize],
                iconColorByVariant[resolvedVariant],
              )}
            >
              {icon}
            </span>
          ) : null}

          <textarea
            {...textareaProps}
            id={textareaId}
            ref={combinedRef}
            value={value}
            rows={autoResize ? 1 : rows}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={handleChange}
            disabled={disabled}
            placeholder={nativePlaceholder}
            aria-invalid={error ? true : ariaInvalid}
            aria-describedby={
              error ? cn(errorId, ariaDescribedBy) : ariaDescribedBy
            }
            className={cn(
              "peer block w-full font-medium transition-[background-color,border-color,box-shadow] duration-150 ease-out focus-visible:outline-none",
              // See elevated-input: while empty, the label owns the value slot.
              isFloating
                ? "placeholder:text-transparent"
                : "placeholder:text-muted-foreground",
              autoResize ? "resize-none" : "resize-y",
              resolvedVariant === "search"
                ? "rounded-lg"
                : "rounded-[--radius]",
              isFloating
                ? floatingSize[resolvedSize]
                : compactSize[resolvedSize],
              icon ? iconPadding[resolvedSize] : basePadding[resolvedSize],
              textareaVariantClasses[resolvedVariant],
              error && isField && ERROR_FIELD,
              disabledClasses,
              autoResize && "overflow-hidden",
              textareaClassName,
            )}
            style={{
              minHeight: autoResize
                ? isFloating
                  ? "60px"
                  : "44px"
                : undefined,
              maxHeight: autoResize ? `${maxHeight}px` : undefined,
            }}
          />

          {/* Follows the textarea so `peer ~` can read its state. The label
              waits on the first text line rather than the middle of the box —
              a textarea's first line is not its centre. */}
          {isFloating ? (
            <label
              htmlFor={textareaId}
              className={cn("field-label", error && "field-label-invalid")}
            >
              {floatingLabel}
            </label>
          ) : null}
        </div>

        {error ? (
          <p
            id={errorId}
            className="mt-1 text-xs font-medium text-destructive-ink"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

ElevatedTextarea.displayName = "ElevatedTextarea";

export default ElevatedTextarea;
