"use client";

import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  MutableRefObject,
  ReactNode,
} from "react";
import { Eye, EyeSlash } from "@/components/icons";
import { forwardRef, useCallback, useId, useRef, useState } from "react";

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

type ButtonVariant = BaseVariant | LegacyVariant;
type ElevatedInputSize = "sm" | "default" | "lg";

type NativeInputProps = ComponentPropsWithoutRef<"input">;

type ElevatedInputProps = NativeInputProps & {
  label?: string;
  icon?: ReactNode;
  inputClassName?: string;
  variant?: ButtonVariant;
  controlSize?: ElevatedInputSize;
  error?: string;
};

const variantAlias: Record<ButtonVariant, BaseVariant> = {
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

const floatingSize: Record<ElevatedInputSize, string> = {
  sm: "h-10 pt-[19px] pb-[3px] text-sm leading-4",
  default: "h-11 pt-[21px] pb-[5px] text-sm leading-4",
  lg: "h-12 pt-[23px] pb-[7px] text-sm leading-4",
};

const compactSize: Record<ElevatedInputSize, string> = {
  sm: "h-8 text-sm",
  default: "h-9 text-sm",
  lg: "h-10 text-sm",
};

const labelTop: Record<ElevatedInputSize, string> = {
  sm: "0.1875rem",
  default: "0.25rem",
  lg: "0.375rem",
};


const basePadding: Record<ElevatedInputSize, string> = {
  sm: "px-3",
  default: "px-3",
  lg: "px-3.5",
};

const iconPadding: Record<ElevatedInputSize, string> = {
  sm: "pl-9",
  default: "pl-9",
  lg: "pl-10",
};

const iconPosition: Record<ElevatedInputSize, string> = {
  sm: "left-2.5",
  default: "left-2.5",
  lg: "left-3",
};

const FIELD = cn(
  "bg-card dark:bg-muted text-foreground border border-control-edge",
  "hover:border-[hsl(var(--muted-foreground)/0.5)]",
  "focus-visible:border-control-edge",
  "focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary-edge))]",
  "focus-visible:ring-2 focus-visible:ring-primary/15",
);

const inputVariantClasses: Record<BaseVariant, string> = {
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

const ElevatedInput = forwardRef<HTMLInputElement, ElevatedInputProps>(
  (
    {
      className,
      inputClassName,
      label,
      value,
      onFocus,
      onBlur,
      onChange,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      icon,
      id,
      placeholder,
      disabled,
      error,
      variant = "secondary",
      controlSize = "default",
      type = "text",
      ...inputProps
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? fallbackId;
    const errorId = `${inputId}-error`;

    const floatingLabel = label?.trim() ? label.trim() : undefined;
    const isFloating = Boolean(floatingLabel);

    const nativePlaceholder = isFloating ? (placeholder ?? " ") : placeholder;

    const combinedRef = useCallback(
      (el: HTMLInputElement | null) => {
        inputRef.current = el;
        if (!ref) return;
        try {
          if (typeof ref === "function") {
            ref(el);
          } else {
            (ref as MutableRefObject<HTMLInputElement | null>).current = el;
          }
        } catch {}
      },
      [ref],
    );

    const resolvedVariant = variantAlias[variant] ?? "secondary";
    const resolvedSize: ElevatedInputSize = controlSize ?? "default";
    const isDateLike = [
      "date",
      "datetime-local",
      "time",
      "month",
      "week",
    ].includes(type);
    const isPasswordType = type === "password";
    const inputType = isPasswordType && showPassword ? "text" : type;
    const isField =
      resolvedVariant !== "primary" && resolvedVariant !== "action";

    const fieldVars = {
      "--field-label-top": labelTop[resolvedSize],
      "--field-label-left": icon
        ? resolvedSize === "lg"
          ? "2.5rem"
          : "2.25rem"
        : resolvedSize === "lg"
          ? "0.875rem"
          : "0.75rem",
    } as CSSProperties;

    return (
      <div className={cn("w-full", className)} style={fieldVars}>
        <div className="relative w-full">
          {icon ? (
            <span
              className={cn(
                "pointer-events-none absolute z-[1] flex items-center",
                isFloating ? "top-1/2 -translate-y-1/2" : "inset-y-0",
                iconPosition[resolvedSize],
                iconColorByVariant[resolvedVariant],
              )}
            >
              {icon}
            </span>
          ) : null}

          <input
            {...inputProps}
            ref={combinedRef}
            id={inputId}
            value={value}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={onChange}
            disabled={disabled}
            type={inputType}
            placeholder={nativePlaceholder}
            aria-invalid={error ? true : ariaInvalid}
            aria-describedby={
              error ? cn(errorId, ariaDescribedBy) : ariaDescribedBy
            }
            className={cn(
              "peer block w-full font-medium transition-[background-color,border-color,box-shadow] duration-150 ease-out focus-visible:outline-none",
              isFloating
                ? "placeholder:text-transparent"
                : "placeholder:text-muted-foreground",
              resolvedVariant === "search"
                ? "rounded-lg"
                : "rounded-[--radius]",
              isFloating ? floatingSize[resolvedSize] : compactSize[resolvedSize],
              icon ? iconPadding[resolvedSize] : basePadding[resolvedSize],
              isPasswordType && "pr-10",
              inputVariantClasses[resolvedVariant],
              error && isField && ERROR_FIELD,
              disabledClasses,
              inputClassName,
            )}
          />

          {
}
          {isFloating ? (
            <label
              htmlFor={inputId}
              className={cn(
                "field-label",
                isDateLike && "field-label-floating",
                error && "field-label-invalid",
              )}
            >
              {floatingLabel}
            </label>
          ) : null}

          {isPasswordType && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-2 z-[2] flex items-center px-1 text-lg text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeSlash /> : <Eye />}
            </button>
          )}
        </div>

        {
}
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

ElevatedInput.displayName = "ElevatedInput";

export default ElevatedInput;
