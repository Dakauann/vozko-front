"use client";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Plus, X } from "@/components/icons";

export function TextListEditor({
  values,
  max,
  maxLength,
  multiline = false,
  label,
  addLabel,
  removeLabel,
  onChange,
}: {
  values: string[];
  max: number;
  maxLength: number;
  multiline?: boolean;
  label: (index: number) => string;
  addLabel: string;
  removeLabel: string;
  onChange: (values: string[]) => void;
}) {
  const set = (index: number, text: string) => onChange(values.map((value, i) => (i === index ? text : value)));

  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {multiline ? (
              <ElevatedTextarea
                label={label(index)}
                value={value}
                maxLength={maxLength}
                onChange={(event) => set(index, event.target.value)}
                autoResize
                maxHeight={200}
              />
            ) : (
              <ElevatedInput
                label={label(index)}
                placeholder=" "
                value={value}
                maxLength={maxLength}
                onChange={(event) => set(index, event.target.value)}
              />
            )}
            <span className="block text-right text-2xs tabular-nums text-muted-foreground">
              {value.length}/{maxLength}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            aria-label={removeLabel}
            className="mt-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
      {values.length < max ? (
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="block text-right text-2xs tabular-nums text-muted-foreground">
      {value.length}/{max}
    </span>
  );
}
