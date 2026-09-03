"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PencilSimple } from "@/components/icons";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string;
  /** Shown, muted, when the value is empty. Never a `placeholder` attribute on a
   *  display element — this is the resting state, not a hint inside a field. */
  placeholder: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  /** Accessible name for the field; also the pencil's tooltip. */
  label: string;
  /** Open in edit mode on mount, for a row that was just created. */
  autoEdit?: boolean;
  /** Typography, shared by the resting text and the field so nothing shifts. */
  className?: string;
  /** Extra classes for the resting button only (truncation, width). */
  displayClassName?: string;
  pencil?: boolean;
}

/**
 * Text that is displayed until you click it, then edited in place.
 *
 * It exists because a composer built from labelled FIELDS does not look like the
 * thing it composes. A board column is a title with a colour beside it; drawing
 * one through a stack of inputs meant the operator designed in one visual
 * language and shipped in another, and the two never quite agreed. Here the
 * resting state IS the final look, and the field only appears for as long as
 * someone is typing into it.
 *
 * The commit rules are the ones people already expect from renaming a file:
 * Enter and blur commit, Escape reverts. Nothing is saved on every keystroke,
 * so an abandoned edit leaves no trace.
 */
export function InlineEdit({
  value,
  placeholder,
  onCommit,
  disabled = false,
  maxLength,
  label,
  autoEdit = false,
  className,
  displayClassName,
  pencil = true,
}: InlineEditProps) {
  const [editing, setEditing] = useState(autoEdit);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape must not be undone by the blur that follows it.
  const abandoned = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const start = useCallback(() => {
    setDraft(value);
    abandoned.current = false;
    setEditing(true);
  }, [value]);

  const finish = useCallback(() => {
    setEditing(false);
    if (abandoned.current) {
      abandoned.current = false;
      return;
    }
    const next = draft.trim();
    if (next !== value.trim()) onCommit(next);
  }, [draft, value, onCommit]);

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        value={draft}
        maxLength={maxLength}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            abandoned.current = true;
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "min-w-0 flex-1 rounded-[--radius] border border-control-edge bg-card px-1.5 py-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      />
    );
  }

  const empty = value.trim().length === 0;

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      title={disabled ? undefined : label}
      className={cn(
        "group/inline -mx-1 flex min-w-0 items-center gap-1 rounded-[--radius] px-1 py-0.5 text-left",
        "transition-colors hover:bg-[hsl(var(--accent-hover))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-70",
        className,
        displayClassName,
      )}
    >
      <span className={cn("truncate", empty && "text-muted-foreground")}>
        {empty ? placeholder : value}
      </span>
      {/* Arrives on hover and on keyboard focus. Always visible, a pencil per
          column turns the strip into a row of buttons. */}
      {pencil ? (
        <PencilSimple
          className="h-3 w-3 flex-none text-muted-foreground opacity-0 transition-opacity group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100"
          weight="bold"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}
