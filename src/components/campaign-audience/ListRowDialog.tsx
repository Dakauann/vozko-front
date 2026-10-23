"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { ListRow, MetadataColumn, RowInput, VariableCount } from "@/lib/campaign-audience/types";

import { useSlotLabel } from "./use-audience-copy";

export interface RowDraft {
  contact: string;
  name: string;
  variables: string[];
  metadata: Record<string, string>;
}

function draftOf(row: ListRow | null, slots: number, metadata: readonly MetadataColumn[]): RowDraft {
  return {
    contact: row?.contact ?? "",
    name: row?.name ?? "",
    variables: Array.from({ length: slots }, (_, index) => row?.variables[index] ?? ""),
    metadata: Object.fromEntries(metadata.map((column) => [column.key, row?.metadata[column.key] === undefined || row?.metadata[column.key] === null ? "" : String(row.metadata[column.key])])),
  };
}

function inputOf(draft: RowDraft, metadata: readonly MetadataColumn[]): RowInput {
  const input: RowInput = { contact: draft.contact, name: draft.name, variables: draft.variables };
  if (metadata.length > 0) input.metadata = Object.fromEntries(Object.entries(draft.metadata).filter(([, value]) => value !== ""));
  return input;
}

export function ListRowDialog({
  open,
  row,
  contact,
  slots,
  variables,
  metadata,
  saving,
  error,
  onSave,
  onClose,
}: {
  open: boolean;
  row: ListRow | null;
  contact: "phone" | "email";
  slots: number;
  variables: readonly VariableCount[];
  metadata: readonly MetadataColumn[];
  saving: boolean;
  error: string | null;
  onSave: (input: RowInput) => void;
  onClose: () => void;
}) {
  const t = useTranslations("campaignAudience.step.list.row");
  const [draft, setDraft] = useState<RowDraft>(() => draftOf(row, slots, metadata));
  const slotLabel = useSlotLabel(variables);
  const contactLabel = contact === "email" ? t("email") : t("phone");

  return (
    <ElevatedDialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <ElevatedDialogContent className="sm:max-w-[520px]">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{row ? t("editTitle") : t("newTitle")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-3">
          <ElevatedInput label={contactLabel} value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} />
          <ElevatedInput label={t("name")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          {draft.variables.map((value, index) => (
            <ElevatedInput
              key={`variable-${index}`}
              label={t("variable", { slot: slotLabel(String(index + 1)) })}
              value={value}
              onChange={(event) => setDraft({ ...draft, variables: draft.variables.map((current, at) => (at === index ? event.target.value : current)) })}
            />
          ))}
          {metadata.map((column) => (
            <ElevatedInput
              key={column.key}
              label={column.label}
              value={draft.metadata[column.key] ?? ""}
              onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, [column.key]: event.target.value } })}
            />
          ))}
          {error ? (
            <p role="alert" className="text-xs font-semibold text-destructive-ink">
              {error}
            </p>
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button type="button" variant="ghost" title={t("cancel")} onClick={onClose} />
          <Button type="button" title={t("save")} disabled={saving || draft.contact.trim() === ""} onClick={() => onSave(inputOf(draft, metadata))} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
