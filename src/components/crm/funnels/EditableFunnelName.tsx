"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { InlineEdit } from "./InlineEdit";

export const MAX_NAME_LENGTH = 120;

interface EditableFunnelNameProps {
  name: string;
  canEdit: boolean;
  busy?: boolean;
  onRename: (name: string) => Promise<void>;
}

export function EditableFunnelName({
  name,
  canEdit,
  busy = false,
  onRename,
}: EditableFunnelNameProps) {
  const t = useTranslations("funnels.rename");

  const commit = useCallback(
    (next: string) => {
      if (next.trim().length < 2) return;
      void onRename(next.trim());
    },
    [onRename],
  );

  if (!canEdit) {
    return (
      <span className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
        {name}
      </span>
    );
  }

  return (
    <InlineEdit
      value={name}
      placeholder={t("label")}
      label={t("edit")}
      maxLength={MAX_NAME_LENGTH}
      disabled={busy}
      onCommit={commit}
      className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-foreground"
      displayClassName="max-w-full"
    />
  );
}
