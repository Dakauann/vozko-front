"use client";

import { useId, useState } from "react";

interface CodeFieldProps {
  label: string;
  hint: string;
  value: string;
  rows?: number;
  disabled?: boolean;
  onCommit: (path: string) => boolean;
}

export function CodeField({ label, hint, value, rows = 2, disabled, onCommit }: CodeFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    if (next === value) {
      setDraft(null);
      setRejected(false);
      return;
    }
    const accepted = onCommit(next);
    setRejected(!accepted);
    if (accepted) setDraft(null);
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-2xs text-muted-foreground">
        {label}
      </label>
      <textarea
        id={id}
        value={draft ?? value}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        aria-invalid={rejected || undefined}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        className="block w-full resize-y rounded-md border border-border bg-background px-2 py-1 font-mono text-2xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-[invalid=true]:border-destructive"
      />
      <p id={`${id}-hint`} className="text-2xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
