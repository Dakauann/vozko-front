"use client";

import { useTranslations } from "next-intl";

import { SHORTCUT_VARIABLES } from "@/lib/message-shortcuts/variables";

export function ShortcutVariableList({ onInsert }: { onInsert: (placeholder: string) => void }) {
  const t = useTranslations("messageShortcutsPage.variables");
  return (
    <div className="space-y-2 rounded-[--radius] border border-border bg-background p-3">
      <div>
        <p className="text-xs font-semibold text-foreground">{t("title")}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">{t("description")}</p>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {SHORTCUT_VARIABLES.map((variable) => {
          const placeholder = `{{${variable.name}}}`;
          return (
            <li key={variable.name}>
              <button
                type="button"
                onClick={() => onInsert(placeholder)}
                className="flex w-full items-center gap-2 rounded-[--radius] px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <code className="font-mono text-2xs text-foreground">{placeholder}</code>
                <span className="truncate text-2xs text-muted-foreground">{t(variable.labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
