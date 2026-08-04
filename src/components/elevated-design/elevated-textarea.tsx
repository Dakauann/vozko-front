"use client";

import type {
  ComponentPropsWithoutRef,
  MutableRefObject,
  ReactNode,
} from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { softSurfaceShadow, softSurfaceWithInset } from "./shadow-presets";

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

const sizeClasses: Record<ElevatedTextareaSize, string> = {
  sm: "text-sm py-2.5",
  default: "text-sm py-3.5",
  lg: "text-[15px] py-4",
};

const basePadding: Record<ElevatedTextareaSize, string> = {
  sm: "px-4",
  default: "px-5",
  lg: "px-6",
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



const textareaVariantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-transparent focus-visible:ring-2 focus-visible:ring-ring",
  secondary:
    "bg-card text-foreground border border-border border-t-rule-strong bg-muted hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-rule-strong",
  outline:
    "bg-card text-foreground border border-border border-t-rule-strong bg-muted hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-rule-strong",
  ghost:
    "bg-card text-foreground border border-transparent hover:border-border focus-visible:ring-2 focus-visible:ring-ring",
  vsl: "bg-muted text-muted-foreground border border-transparent focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(12,42,36,0.65)]",
  action:
    "bg-primary text-primary-foreground border border-primary focus-visible:ring-2 focus-visible:ring-ring",
  search:
    "bg-muted text-foreground border border-transparent hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-foreground/20",
};

const disabledClasses =
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted disabled:text-muted-foreground disabled:border-muted";

const iconColorByVariant: Record<BaseVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-lamp-ink/60",
  outline: "text-lamp-ink/60",
  ghost: "text-muted-foreground",
  vsl: "text-white",
  action: "text-primary-foreground",
  search: "text-muted-foreground",
};



const textareaShadowByVariant: Record<BaseVariant, string> = {
  primary: `${softSurfaceShadow}, inset 0 1px 0 var(--shadow-highlight)`,
  secondary: softSurfaceWithInset,
  outline: softSurfaceShadow,
  ghost: "0 16px 30px -20px rgba(15,23,42,0.22)",
  vsl: "0 22px 38px -20px rgba(14,165,233,0.42)",
  action: `${softSurfaceShadow}, inset 0 1px 0 var(--shadow-highlight)`,
  search: "0 8px 16px -10px rgba(15,23,42,0.12)",
};

const disabledShadow =
  "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

const ElevatedTextarea = forwardRef<HTMLTextAreaElement, ElevatedTextareaProps>(
  (
    {
      className,
      textareaClassName,
      label,
      value,
      onFocus,
      onBlur,
      onChange,
      icon,
      disabled,
      rows = 4,
      variant = "secondary",
      controlSize = "default",
      autoResize = false,
      maxHeight = 150,
      ...textareaProps
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const [hasValue, setHasValue] = useState(() => {
      const hasValueProp =
        value !== undefined && value !== "" && value !== null;
      const hasDefault =
        textareaProps.defaultValue !== undefined &&
        textareaProps.defaultValue !== "" &&
        textareaProps.defaultValue !== null;
      return hasValueProp || hasDefault;
    });
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

    useEffect(() => {
      const checkValue = () => {
        if (textareaRef.current) {
          const currentValue = textareaRef.current.value !== "";
          const shouldHaveValue =
            currentValue || (value !== undefined && value !== "");

          setHasValue(Boolean(shouldHaveValue));
          return;
        }

        setHasValue(value !== undefined && value !== "" && value !== null);
      };

      checkValue();

      const interval = setInterval(checkValue, 150);

      return () => clearInterval(interval);
    }, [value]);

    const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
      setFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
      setFocused(false);
      setHasValue(event.target.value !== "");
      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setHasValue(event.target.value !== "");
      onChange?.(event);
      adjustHeight();
    };

    const resolvedVariant = variantAlias[variant] ?? "secondary";
    const resolvedSize: ElevatedTextareaSize = controlSize ?? "default";

    const boxShadowValue = disabled
      ? disabledShadow
      : textareaShadowByVariant[resolvedVariant];

    return (
      <div className={cn("w-full", className)}>
        {label ? (
          <label className="legend mb-1 block max-w-full truncate">
            {label}
          </label>
        ) : null}
        <div className="relative w-full">
        {icon ? (
          <span
            className={cn(
              "pointer-events-none absolute z-[1] flex items-center",
              iconPosition[resolvedSize],
            )}
            style={{ color: iconColorByVariant[resolvedVariant] }}
          >
            {icon}
          </span>
        ) : null}

        <textarea
          {...textareaProps}
          ref={combinedRef}
          value={value}
          rows={autoResize ? 1 : rows}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "peer block w-full font-medium transition-all duration-200 ease-out focus-visible:outline-none placeholder:text-transparent",
            autoResize ? "resize-none" : "resize-y",
            resolvedVariant === "ghost"
              ? "rounded-[--radius]"
              : resolvedVariant === "action" || resolvedVariant === "search"
                ? "rounded-lg"
                : "rounded-[--radius]",
            sizeClasses[resolvedSize],
            icon ? iconPadding[resolvedSize] : basePadding[resolvedSize],
            textareaVariantClasses[resolvedVariant],
            disabledClasses,
            autoResize && "overflow-hidden",
            textareaClassName,
          )}
          style={{
            boxShadow: boxShadowValue,
            minHeight: autoResize ? "44px" : undefined,
            maxHeight: autoResize ? `${maxHeight}px` : undefined,
          }}
        />

        {/* Static legend above the field — see elevated-input for the reasoning:
            a label that animates up through its own border belongs to a
            different system than this one. */}
        </div>
      </div>
    );
  },
);

ElevatedTextarea.displayName = "ElevatedTextarea";

export default ElevatedTextarea;
