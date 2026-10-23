"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Plus, X } from "@/components/icons";
import { addListValue } from "@/lib/workflows/webhook-trigger";

export function StringListField({
  label,
  description,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("workflowsPage.stringList");
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const add = () => {
    onChange(addListValue(value, draft));
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <ElevatedInput
          id={inputId}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
        />
        <ElevatedButton variant="outline-subtle" size="sm" title={t("add")} iconVisible icon={<Plus className="h-3.5 w-3.5" />} disabled={!draft.trim()} onClick={add} />
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-[--radius] border border-control-edge bg-card py-0.5 pl-2 pr-0.5 font-mono text-2xs text-foreground">
              {item}
              <button
                type="button"
                aria-label={t("remove", { value: item })}
                onClick={() => onChange(value.filter((entry) => entry !== item))}
                className="rounded-[--radius] p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-2xs text-muted-foreground">{t("empty")}</p>
      )}
      {description ? <p className="text-2xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
