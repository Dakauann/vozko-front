"use client";

import { useEffect, useMemo, useState } from "react";

import { listGroupCategoriesAction } from "@/app/actions/unofficial-whatsapp-groups";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { MAX_CATEGORY_CHARS } from "@/lib/unofficial-whatsapp-groups/types";

import { categorySuggestions } from "../list/create-group-form";

function useGroupCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listGroupCategoriesAction().then((loaded) => {
      if (!cancelled) setCategories(loaded.categories);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return categories;
}

export function CategoryField({
  label,
  suggestionsLabel,
  value,
  onChange,
  hint,
}: {
  label: string;
  suggestionsLabel: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const categories = useGroupCategories();
  const suggestions = useMemo(() => categorySuggestions(categories, value), [categories, value]);
  return (
    <div className="space-y-2">
      <ElevatedInput label={label} placeholder=" " value={value} maxLength={MAX_CATEGORY_CHARS} onChange={(event) => onChange(event.target.value)} />
      {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label={suggestionsLabel} role="group">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className="rounded-[--radius] border border-border bg-card px-2 py-0.5 text-2xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
