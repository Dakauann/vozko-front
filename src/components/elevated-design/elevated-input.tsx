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

/**
 * Heights, and why there are two sets of them.
 *
 * A field carrying a floating label has to stack two lines of type — the risen
 * label and the value — so it runs taller than the bare control it replaces.
 * How much taller was a judgement call, and the first one (44/48/56, straight
 * off Material's filled field) came back too heavy for a console: pinned to
 * 40 / 44 / 48 on 2026-09-01.
 *
 * The scale only fits because the value runs at leading-4 rather than the
 * default 20px line box. At 44px: 1px border + 21px pad + 16px line + 5px pad
 * + 1px border, with the risen 12px label occupying 4–19.6px. Four pixels of
 * clearance. Change any one of those numbers and the label lands on the value.
 *
 * A field with no label keeps the old compact heights. Toolbar search boxes,
 * inline filters and table-row editors pass a placeholder and nothing else;
 * there is no label to float, and 79 of the app's small fields sit in toolbars
 * where extra height would buy nothing at all.
 */
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

/** Where the risen label sits, per height. */
const labelTop: Record<ElevatedInputSize, string> = {
  sm: "0.1875rem",
  default: "0.25rem",
  lg: "0.375rem",
};

/**
 * Where it WAITS: dead centre of the control.
 *
 * The obvious alternative — centre it on the VALUE's line box, so the rise is
 * a straight vertical lift — was built and rejected. The value sits low in the
 * box because the top padding is reserved for the risen label, so a label
 * parked on it lands ~8px below centre and an empty field reads as broken.
 * Material's own filled field does exactly that and gets away with it at 56px;
 * at 44px it just looks wrong.
 *
 * The rule that holds instead: an EMPTY control must look exactly as it would
 * with no floating mechanism at all. The label is the only thing in the box, so
 * it belongs in the middle of it. The rise then reads as the label getting out
 * of the way, which is what it is.
 *
 * Centre is the CSS default for the resting state, so there is nothing to set.
 */

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

/**
 * A field is a WELL IN DARK and a SHEET IN LIGHT.
 *
 * It was a --muted well in both, and in light that is a dated pattern: a grey
 * fill on a white card is the 2012 form input, and it measured 1.17:1 / APCA
 * Lc 8 against its own card — below the ~Lc 15 a fill needs to read as a plane
 * at all, so it landed as a stain on white rather than a surface. Light now
 * keeps the sheet and lets the 3:1 --control-edge do the bounding, which is
 * what it is for and what every current light-mode field does.
 *
 * Dark keeps the well. On graphite a lifted fill is right, and fill separation
 * there is structurally capped anyway — reaching Lc 18 against the card would
 * mean going to mid-grey — so dark leans on the border too.
 *
 * FOCUS DOES NOT MOVE THE GROUND. In light the field is already the top plane,
 * so there is nowhere to lift to. In dark it cannot lift: --muted is LIGHTER
 * than --card there, so the old `focus-visible:bg-card` was sinking the field
 * while claiming to raise it, and lifting to --accent-hover instead drops
 * --control-edge to 2.71:1, under the 3:1 the boundary owes. The border, the
 * 2px brand underline and the ring carry focus — all three of which only
 * started rendering once the inline box-shadow suppressing them was removed.
 */
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

/** Error re-colours the edge and the underline; the message renders below. */
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
  // A resting field is not commit, selection or focus, so its icon carries no
  // brand ink — the focus underline is where the green arrives.
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

    // A field floats its label only when it HAS one. Everything else keeps the
    // compact height and simply shows its placeholder at rest.
    const floatingLabel = label?.trim() ? label.trim() : undefined;
    const isFloating = Boolean(floatingLabel);

    // The label mechanism is CSS, keyed off :placeholder-shown — which is also
    // why the old 150ms autofill polling interval could be deleted outright
    // rather than replaced. Chrome fires no event when it autofills, but an
    // autofilled input is not :placeholder-shown, so the label is already up
    // before the first frame paints.
    //
    // The contract that makes it work: a floating field ALWAYS carries a
    // placeholder. A real hint stays transparent until focus, where it would
    // otherwise collide with the resting label; a field with no hint gets a
    // single space purely so the selector can flip.
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
    // A date/time input paints its own format hint and ignores `placeholder`
    // entirely, so :placeholder-shown cannot be trusted to flip for it. Its
    // label is pinned up, or it would sit on top of "dd/mm/aaaa".
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
              // On a floating field the LABEL is what occupies the value slot
              // while empty, so the native placeholder stays invisible for as
              // long as it would collide with it — which is exactly as long as
              // the field is empty. It exists only to drive :placeholder-shown.
              // A compact field shows its placeholder immediately; there, the
              // hint is the only thing standing in for a label.
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

          {/* After the input on purpose: the label rides `peer ~` off the
              input's own :placeholder-shown and :focus state, which needs it
              to be a following sibling. htmlFor keeps the association real —
              this is a label, never a placeholder standing in for one. */}
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

        {/* The `error` prop used to be accepted, typed and thrown away — it
            only ever flipped aria-invalid, so a form passing a message showed
            a sighted user nothing. */}
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
