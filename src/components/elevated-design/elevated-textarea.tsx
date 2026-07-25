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

const labelOffsets: Record<
  ElevatedTextareaSize,
  { withIcon: string; withoutIcon: string }
> = {
  sm: { withIcon: "left-[2.75rem]", withoutIcon: "left-4" },
  default: { withIcon: "left-[3.25rem]", withoutIcon: "left-5" },
  lg: { withIcon: "left-[3.75rem]", withoutIcon: "left-6" },
};

const restingLabelTop: Record<ElevatedTextareaSize, string> = {
  sm: "top-2.5",
  default: "top-3.5",
  lg: "top-4",
};

const textareaVariantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-transparent focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  secondary:
    "bg-card text-foreground border border-border hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  outline:
    "bg-card text-foreground border border-border hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ghost:
    "bg-card/90 backdrop-blur text-foreground border border-transparent hover:border-border focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  vsl: "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white border border-transparent focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(12,42,36,0.65)]",
  action:
    "bg-primary text-primary-foreground border border-primary focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  search:
    "bg-muted text-foreground border border-transparent hover:border-border focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
};

const disabledClasses =
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/40 disabled:text-muted-foreground disabled:border-muted";

const iconColorByVariant: Record<BaseVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-primary/60",
  outline: "text-primary/60",
  ghost: "text-muted-foreground",
  vsl: "text-white",
  action: "text-primary-foreground",
  search: "text-muted-foreground",
};

const floatingLabelClasses: Record<BaseVariant, string> = {
  primary: "bg-primary/95 text-primary-foreground shadow-sm",
  secondary: "bg-card text-foreground shadow-sm",
  outline: "bg-card text-foreground shadow-sm",
  ghost: "bg-card/95 text-foreground backdrop-blur shadow-sm",
  vsl: "bg-gradient-to-r from-cyan-500/90 to-emerald-500/90 text-white shadow-sm",
  action: "bg-primary text-primary-foreground shadow-sm",
  search: "bg-muted text-foreground shadow-sm",
};

const restingLabelClasses: Record<BaseVariant, string> = {
  primary: "text-primary-foreground/80",
  secondary: "text-muted-foreground",
  outline: "text-muted-foreground",
  ghost: "text-muted-foreground",
  vsl: "text-white/85",
  action: "text-primary-foreground/80",
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
  "0 12px 24px -20px rgba(15,23,42,0.12), inset 0 1px 0 var(--shadow-highlight)";

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
    const isFloating = focused || hasValue || (!!value && value !== "");

    const boxShadowValue = disabled
      ? disabledShadow
      : textareaShadowByVariant[resolvedVariant];

    return (
      <div className={cn("relative w-full", className)}>
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
              ? "rounded-2xl"
              : resolvedVariant === "action" || resolvedVariant === "search"
                ? "rounded-lg"
                : "rounded-xl",
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

        {label ? (
          <label
            className={cn(
              "absolute pointer-events-none rounded-full px-2 py-[2px] transition-all duration-200 ease-out",
              icon
                ? labelOffsets[resolvedSize].withIcon
                : labelOffsets[resolvedSize].withoutIcon,
              isFloating
                ? cn(
                    "top-0 -translate-y-1/2 text-[11px] font-semibold",
                    floatingLabelClasses[resolvedVariant],
                  )
                : cn(
                    restingLabelTop[resolvedSize],
                    "text-sm",
                    restingLabelClasses[resolvedVariant],
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

ElevatedTextarea.displayName = "ElevatedTextarea";

export default ElevatedTextarea;
