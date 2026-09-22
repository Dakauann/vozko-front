"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PencilSimple } from "@/components/icons";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  label: string;
  autoEdit?: boolean;
  className?: string;
  displayClassName?: string;
  pencil?: boolean;
}

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
      {
}
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
