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

// 32 / 36 / 40 — the Azure form density. The reference sets its default text
// field at 32px against 32px buttons; the label renders ABOVE the field, so
// height buys nothing but air. `lg` stays for auth/marketing forms where a
// field is the page's main event. (These were 36/40/48, and before that
// 40/48/56 — each identity pass has pulled the field closer to the control
// row it actually sits in.)
const sizeClasses: Record<ElevatedInputSize, string> = {
  sm: "h-8 text-sm",
  default: "h-9 text-sm",
  lg: "h-10 text-sm",
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


// Every text-entry variant is a white sheet with a hairline, and every one of
// them focuses the same way: the brand underline drawn as an inset shadow plus
// a soft halo. The outgoing versions stacked `bg-card` and `bg-muted` on the
// same element — the later class won, so every field in the app rendered as a
// grey sunk track regardless of which variant a page asked for.
const FIELD =
  "bg-card text-foreground border border-border-strong hover:border-[hsl(var(--muted-foreground)/0.5)] focus-visible:border-border-strong focus-visible:shadow-[inset_0_-2px_0_0_hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-primary/15";

const inputVariantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  secondary: FIELD,
  outline: FIELD,
  ghost:
    "bg-card text-foreground border border-transparent hover:border-border focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/15",
  vsl: FIELD,
  action:
    "bg-primary text-primary-foreground border border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  // Search keeps a quiet fill: it lives in toolbars where a full white field
  // beside white content has no edge to read against.
  search:
    "bg-muted text-foreground border border-transparent hover:border-border focus-visible:bg-card focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/15",
};

const disabledClasses =
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted disabled:text-muted-foreground disabled:border-muted";

const iconColorByVariant: Record<BaseVariant, string> = {
  primary: "text-primary-foreground",
  // A resting field is not commit, selection or focus, so its icon carries no
  // brand ink — the focus underline is where the green arrives.
  secondary: "text-muted-foreground",
  outline: "text-muted-foreground",
  ghost: "text-muted-foreground",
  vsl: "text-muted-foreground",
  action: "text-primary-foreground",
  search: "text-muted-foreground",
};



// A resting field does not float. These were hand-tuned 20-38px blurs that put
// a soft glow under every input on the page; a field sits ON the sheet, and its
// hairline is what bounds it. `none` also leaves the box-shadow slot free for
// the focus underline to occupy.
const inputShadowByVariant: Record<BaseVariant, string> = {
  primary: "none",
  secondary: "none",
  outline: "none",
  ghost: "none",
  vsl: "none",
  action: "none",
  search: "none",
};

const disabledShadow =
  "var(--elev-1)";

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
              ? "placeholder:text-transparent focus:placeholder:text-muted-foreground"
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
