"use client";

import type { ReactNode } from "react";

import { COMPOSER_BOX, COMPOSER_ROW } from "@/components/crm/composer-chrome";
import { ArrowDown } from "@/components/icons";

export function ChatComposerFrame({ children }: { children: ReactNode }) {
  return <div className="vz-composer relative flex-shrink-0 border-t border-border bg-card/60">{children}</div>;
}

export function ChatComposerRow({ start, field, end, send }: { start?: ReactNode; field: ReactNode; end?: ReactNode; send: ReactNode }) {
  return (
    <div className={COMPOSER_ROW}>
      <div className={COMPOSER_BOX}>
        <div className="vz-composer-tools-start flex flex-wrap items-end gap-0.5">{start}</div>
        <div className="vz-composer-field relative">{field}</div>
        <div className="vz-composer-tools-end flex items-center gap-0.5">{end}</div>
      </div>
      {send}
    </div>
  );
}

export function ChatScrollDownButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  );
}
