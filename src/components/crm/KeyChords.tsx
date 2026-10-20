"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

import { usePlatform } from "@/hooks/use-shortcuts";
import { chordKeys } from "@/lib/keyboard/chord";
import { CRM_SHORTCUT_NAMESPACE } from "@/lib/keyboard/crm-bindings";
import { cn } from "@/lib/utils";

export function KeyChords({ keys, className }: { keys: readonly string[]; className?: string }) {
  const t = useTranslations(CRM_SHORTCUT_NAMESPACE);
  const platform = usePlatform();
  return (
    <span className={cn("inline-flex items-center gap-1 text-2xs text-muted-foreground", className)}>
      {keys.map((chord, index) => (
        <Fragment key={chord}>
          {index > 0 ? <span>{t("or")}</span> : null}
          <span className="inline-flex items-center gap-0.5">
            {chordKeys(chord, platform).map((part) => (
              <kbd
                key={part}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-[--radius] border border-border bg-muted px-1 font-sans text-2xs font-semibold text-foreground"
              >
                {part}
              </kbd>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
