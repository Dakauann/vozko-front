"use client";

import { useTranslations } from "next-intl";

import type { CommentTopic } from "@/lib/comment-analysis/types";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Plus, Trash } from "@/components/icons";

/*
 * The topic set editor, shared by the account settings and the per-post
 * override so the two never drift: same rows, same limit, same "Outros"
 * footer. It is a controlled list; whoever renders it owns the draft and
 * decides when to save.
 */

export const MAX_TOPICS = 30;

// The list helpers live in lib/comment-analysis/override.ts (tested there)
// and are re-exported so the two editors import one thing.
export { cleanTopics, editableTopics } from "@/lib/comment-analysis/override";

export function TopicsEditor({
  topics,
  onChange,
  disabled,
}: {
  topics: CommentTopic[];
  onChange: (next: CommentTopic[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("commentAnalysis.settings.topics");

  const update = (index: number, field: "label" | "description", value: string) => {
    onChange(topics.map((tp, i) => (i === index ? { ...tp, [field]: value } : tp)));
  };

  return (
    <div>
      <ul className="space-y-2">
        {topics.map((tp, index) => (
          <li key={`${tp.key || "new"}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-2">
            <ElevatedInput value={tp.label} placeholder={t("labelPlaceholder")} disabled={disabled} onChange={(e) => update(index, "label", e.target.value)} controlSize="sm" />
            <ElevatedInput value={tp.description ?? ""} placeholder={t("descriptionPlaceholder")} disabled={disabled} onChange={(e) => update(index, "description", e.target.value)} controlSize="sm" />
            <button
              type="button"
              aria-label={t("remove")}
              disabled={disabled}
              className="rounded-[--radius] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink disabled:opacity-50"
              onClick={() => onChange(topics.filter((_, i) => i !== index))}
            >
              <Trash className="h-4 w-4" />
            </button>
          </li>
        ))}
        <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-2 text-xs text-muted-foreground">
          <span className="px-1">{t("otherLabel")}</span>
          <span className="px-1">{t("otherHint")}</span>
          <span className="w-7" />
        </li>
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xs text-muted-foreground">{t("limit", { max: MAX_TOPICS })}</p>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
          title={t("add")}
          disabled={disabled || topics.length >= MAX_TOPICS}
          onClick={() => onChange([...topics, { key: "", label: "", description: "" }])}
        />
      </div>
    </div>
  );
}
