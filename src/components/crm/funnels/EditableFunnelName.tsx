"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { InlineEdit } from "./InlineEdit";

/** Mirrors the server's pipeline name column so the field stops before a 400. */
export const MAX_NAME_LENGTH = 120;

interface EditableFunnelNameProps {
  name: string;
  /** RBAC: stages:update. Without it the name renders as plain text. */
  canEdit: boolean;
  busy?: boolean;
  onRename: (name: string) => Promise<void>;
}

/**
 * The funnel's name, edited where it is displayed.
 *
 * It replaces a name FIELD that sat directly under this heading and printed the
 * same word twice — once as the panel title, once as the field's value, with the
 * field's floating label landing on top of it. Two controls for one string was
 * the bug; the second copy was never the fix.
 *
 * Same gesture as a stage's name on the board and as `EditableLeadName` in the
 * CRM, deliberately: an operator should not learn three ways to rename a thing.
 */
export function EditableFunnelName({
  name,
  canEdit,
  busy = false,
  onRename,
}: EditableFunnelNameProps) {
  const t = useTranslations("funnels.rename");

  const commit = useCallback(
    (next: string) => {
      // A funnel with no name is unpickable in the CRM's selector, so an empty
      // or one-character rename is refused by keeping the old name rather than
      // by showing an error on a heading.
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
