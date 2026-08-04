"use client";

import type {
  ComponentPropsWithoutRef,
  MutableRefObject,
  ReactNode,
} from "react";
import { Eye, EyeSlash } from "@/components/icons";
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


const inputVariantClasses: Record<BaseVariant, string> = {
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
  "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

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
      isDateLikeType || focused || hasValue || (!!value && value !== "");

    const boxShadowValue = disabled
      ? disabledShadow
      : inputShadowByVariant[resolvedVariant];

    const isPasswordType = type === "password";
    const inputType = isPasswordType && showPassword ? "text" : type;

    return (
      <div className={cn("w-full", className)}>
        {visibleLabel ? (
          <label htmlFor={inputId} className="legend mb-1 block max-w-full truncate">
            {visibleLabel}
          </label>
        ) : null}
        <div className="relative w-full">
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
              ? "rounded-[--radius]"
              : resolvedVariant === "action" || resolvedVariant === "search"
                ? "rounded-lg"
                : "rounded-[--radius]",
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
        </div>
      </div>
    );
  },
);

ElevatedInput.displayName = "ElevatedInput";

export default ElevatedInput;
