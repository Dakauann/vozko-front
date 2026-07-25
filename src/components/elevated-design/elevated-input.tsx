"use client";

import type {
  ComponentPropsWithoutRef,
  MutableRefObject,
  ReactNode,
} from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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

const sizeClasses: Record<ElevatedInputSize, string> = {
  sm: "h-10 text-sm",
  default: "h-12 text-sm",
  lg: "h-14 text-[15px]",
};

const basePadding: Record<ElevatedInputSize, string> = {
  sm: "px-4",
  default: "px-5",
  lg: "px-6",
};

const iconPadding: Record<ElevatedInputSize, string> = {
  sm: "pl-[2.75rem]",
  default: "pl-[3.25rem]",
  lg: "pl-[3.75rem]",
};

const iconPosition: Record<ElevatedInputSize, string> = {
  sm: "left-3",
  default: "left-4",
  lg: "left-5",
};

const labelOffsets: Record<
  ElevatedInputSize,
  { withIcon: string; withoutIcon: string }
> = {
  sm: { withIcon: "left-[2.75rem]", withoutIcon: "left-4" },
  default: { withIcon: "left-[3.25rem]", withoutIcon: "left-5" },
  lg: { withIcon: "left-[3.75rem]", withoutIcon: "left-6" },
};

const inputVariantClasses: Record<BaseVariant, string> = {
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

const inputShadowByVariant: Record<BaseVariant, string> = {
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
    const [focused, setFocused] = useState(false);
    const [hasValue, setHasValue] = useState(() => {
      const hasValueProp =
        value !== undefined && value !== "" && value !== null;
      const hasDefault =
        inputProps.defaultValue !== undefined &&
        inputProps.defaultValue !== "" &&
        inputProps.defaultValue !== null;
      return hasValueProp || hasDefault;
    });
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? fallbackId;
    const explicitLabel = label?.trim() ? label : undefined;
    const placeholderLabel = placeholder?.trim() ? placeholder : undefined;
    const visibleLabel = explicitLabel ?? placeholderLabel;
    const nativePlaceholder = explicitLabel ? placeholder : undefined;

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

    useEffect(() => {
      const checkValue = () => {
        if (inputRef.current) {
          const isAutofilled = inputRef.current.matches(":-webkit-autofill");
          const currentValue = inputRef.current.value !== "";
          const shouldHaveValue =
            isAutofilled ||
            currentValue ||
            (value !== undefined && value !== "");

          setHasValue(Boolean(shouldHaveValue));
          return;
        }

        setHasValue(value !== undefined && value !== "" && value !== null);
      };

      checkValue();

      const interval = setInterval(checkValue, 150);

      return () => clearInterval(interval);
    }, [value]);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      setHasValue(event.target.value !== "");
      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(event.target.value !== "");
      onChange?.(event);
    };

    const resolvedVariant = variantAlias[variant] ?? "secondary";
    const resolvedSize: ElevatedInputSize = controlSize ?? "default";
    const isDateLikeType = [
      "date",
      "datetime-local",
      "time",
      "month",
      "week",
    ].includes(type);
    const isFloating =
      isDateLikeType || focused || hasValue || (!!value && value !== "");

    const boxShadowValue = disabled
      ? disabledShadow
      : inputShadowByVariant[resolvedVariant];

    const isPasswordType = type === "password";
    const inputType = isPasswordType && showPassword ? "text" : type;

    return (
      <div className={cn("relative w-full", className)}>
        {icon ? (
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 z-[1] flex items-center",
              iconPosition[resolvedSize],
            )}
            style={{ color: iconColorByVariant[resolvedVariant] }}
          >
            {icon}
          </span>
        ) : null}

        <input
          {...inputProps}
          ref={combinedRef}
          id={inputId}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          disabled={disabled}
          type={inputType}
          placeholder={nativePlaceholder}
          aria-invalid={error ? true : ariaInvalid}
          className={cn(
            "peer block w-full font-medium transition-all duration-200 ease-out focus-visible:outline-none",
            visibleLabel
              ? "placeholder:text-transparent focus:placeholder:text-muted-foreground/70"
              : "placeholder:text-muted-foreground",
            resolvedVariant === "ghost"
              ? "rounded-2xl"
              : resolvedVariant === "action" || resolvedVariant === "search"
                ? "rounded-lg"
                : "rounded-full",
            sizeClasses[resolvedSize],
            icon ? iconPadding[resolvedSize] : basePadding[resolvedSize],
            inputVariantClasses[resolvedVariant],
            disabledClasses,
            inputClassName,
          )}
          style={{ boxShadow: boxShadowValue }}
        />

        {isPasswordType && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={cn(
              "absolute right-4 inset-y-0 z-[2] flex items-center px-1 text-xl text-muted-foreground hover:text-foreground transition-colors",
              resolvedSize === "sm"
                ? "right-3"
                : resolvedSize === "lg"
                  ? "right-5"
                  : "right-4",
            )}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeSlash /> : <Eye />}
          </button>
        )}

        {visibleLabel ? (
          <label
            htmlFor={inputId}
            className={cn(
              "absolute pointer-events-none max-w-[calc(100%-2rem)] truncate rounded-full px-2 py-[2px] transition-all duration-200 ease-out",
              icon
                ? labelOffsets[resolvedSize].withIcon
                : labelOffsets[resolvedSize].withoutIcon,
              isFloating
                ? cn(
                    "top-0 -translate-y-1/2 text-[11px] font-semibold",
                    floatingLabelClasses[resolvedVariant],
                  )
                : cn(
                    "top-1/2 -translate-y-1/2 text-sm",
                    restingLabelClasses[resolvedVariant],
                  ),
            )}
            style={{ transformOrigin: "left center" }}
          >
            {visibleLabel}
          </label>
        ) : null}
      </div>
    );
  },
);

ElevatedInput.displayName = "ElevatedInput";

export default ElevatedInput;
