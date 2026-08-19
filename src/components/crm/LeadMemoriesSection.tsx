"use client";

import type { LeadMemory, LeadMemoryCategory, LeadMemoryError } from "@/lib/lead-memories/types";
import {
    LEAD_MEMORY_CATEGORIES,
    LEAD_MEMORY_MAX_CONTENT_LENGTH,
} from "@/lib/lead-memories/types";
import { Brain, Check, PencilSimple, Plus, Trash, X } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import {
    createLeadMemoryAction,
    deleteLeadMemoryAction,
    listLeadMemoriesAction,
    updateLeadMemoryAction,
} from "@/app/actions/lead-memories";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface LeadMemoriesSectionProps {
    /** Null when the conversation is not bridged to a CRM lead yet. */
    leadId: string | null;
    /** Mirrors `leads:update`; read-only rendering without it. */
    canManage: boolean;
}

/**
 * The lead's memory: facts the AI saved via its manage_lead_memory tool plus
 * notes operators added by hand: the SAME list the agent sees injected into
 * its prompt on every channel. Nothing the AI remembers is invisible here;
 * that visibility is the feature's safety tripwire.
 *
 * Self-fetching by design (deviation from ScheduledMessagesPanel's
 * parent-owned state): it renders both in the inbox context rail and on the
 * lead page, and parent-owning the fetch in two places would duplicate it.
 */
export default function LeadMemoriesSection({ leadId, canManage }: LeadMemoriesSectionProps) {
    const t = useTranslations("leadMemories");

    const [memories, setMemories] = useState<LeadMemory[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<LeadMemoryCategory | null>(null);
    const [adding, setAdding] = useState(false);

    const refetch = useCallback(async () => {
        if (!leadId) return;
        setLoading(true);
        const result = await listLeadMemoriesAction(leadId, filter ?? undefined);
        setLoading(false);
        if (result.error) {
            toast.error(t("errors.generic"));
            return;
        }
        setMemories(result.memories);
        setTotal(result.total);
    }, [leadId, filter, t]);

    useEffect(() => {
        setMemories([]);
        setTotal(0);
        void refetch();
    }, [refetch]);

    if (!leadId) {
        return (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Brain className="h-6 w-6 text-muted-foreground" weight="regular" />
                <p className="text-xs text-muted-foreground">{t("noLead")}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 px-3 py-3">
            <div className="flex flex-wrap gap-1">
                <CategoryPill
                    label={t("filterAll")}
                    active={filter === null}
                    onClick={() => setFilter(null)}
                />
                {LEAD_MEMORY_CATEGORIES.map((category) => (
                    <CategoryPill
                        key={category}
                        label={t(`categories.${category}`)}
                        active={filter === category}
                        onClick={() => setFilter(filter === category ? null : category)}
                    />
                ))}
            </div>

            {canManage &&
                (adding ? (
                    <MemoryForm
                        onCancel={() => setAdding(false)}
                        onSubmit={async (content, category) => {
                            const result = await createLeadMemoryAction(leadId, { content, category });
                            if (result.error) {
                                toast.error(memoryErrorCopy(result.error, t));
                                return false;
                            }
                            setAdding(false);
                            void refetch();
                            return true;
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="flex items-center justify-center gap-1.5 rounded-[--radius] border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary-ink"
                    >
                        <Plus className="h-3.5 w-3.5" weight="bold" />
                        {t("addButton")}
                    </button>
                ))}

            {memories.length === 0 && !loading ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                    {filter ? t("emptyFiltered") : t("empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {memories.map((memory) => (
                        <MemoryRow
                            key={memory.id}
                            memory={memory}
                            canManage={canManage}
                            onChanged={refetch}
                        />
                    ))}
                </ul>
            )}

            {total > memories.length ? (
                <p className="text-center text-2xs text-muted-foreground">
                    {t("showing", { shown: memories.length, total })}
                </p>
            ) : null}
        </div>
    );
}

function CategoryPill({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-[--radius] border px-2 py-0.5 text-2xs font-medium transition-colors max-sm:min-h-[34px]",
                active
                    ? "border-primary bg-primary-subtle font-semibold text-primary-ink"
                    : "border-border text-muted-foreground hover:text-foreground",
            )}
        >
            {label}
        </button>
    );
}

function MemoryRow({
    memory,
    canManage,
    onChanged,
}: {
    memory: LeadMemory;
    canManage: boolean;
    onChanged: () => void;
}) {
    const t = useTranslations("leadMemories");
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);

    const byLine =
        memory.actorLabel ||
        (memory.actorKind === "ai"
            ? t("byAi")
            : memory.actorKind === "system"
              ? t("bySystem")
              : t("byOperator"));
    const when = new Date(memory.updatedAt || memory.createdAt).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

    const handleDelete = async () => {
        setBusy(true);
        const result = await deleteLeadMemoryAction(memory.id);
        setBusy(false);
        setConfirmingDelete(false);
        if (result.error) {
            toast.error(memoryErrorCopy(result.error, t));
            return;
        }
        onChanged();
    };

    if (editing) {
        return (
            <li>
                <MemoryForm
                    initialContent={memory.content}
                    initialCategory={memory.category}
                    onCancel={() => setEditing(false)}
                    onSubmit={async (content, category) => {
                        const result = await updateLeadMemoryAction(memory.id, { content, category });
                        if (result.error) {
                            toast.error(memoryErrorCopy(result.error, t));
                            return false;
                        }
                        setEditing(false);
                        onChanged();
                        return true;
                    }}
                />
            </li>
        );
    }

    return (
        <li className="rounded-[--radius] border border-border bg-card px-3 py-2">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <span className="inline-block rounded-full bg-muted px-1.5 py-px text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t(`categories.${memory.category}`)}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{memory.content}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">
                        {t("attribution", { who: byLine, when })}
                    </p>
                </div>

                {canManage ? (
                    <div className="flex flex-shrink-0 items-center gap-0.5">
                        {confirmingDelete ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={busy}
                                    aria-label={t("confirmDelete")}
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-destructive-ink transition-colors hover:bg-muted disabled:opacity-40"
                                >
                                    <Check className="h-3 w-3" weight="bold" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(false)}
                                    aria-label={t("cancelButton")}
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                                >
                                    <X className="h-3 w-3" weight="bold" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setEditing(true)}
                                    aria-label={t("editButton")}
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                    <PencilSimple className="h-3 w-3" weight="bold" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(true)}
                                    aria-label={t("deleteButton")}
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink"
                                >
                                    <Trash className="h-3 w-3" weight="bold" />
                                </button>
                            </>
                        )}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

function MemoryForm({
    initialContent = "",
    initialCategory = "other",
    onSubmit,
    onCancel,
}: {
    initialContent?: string;
    initialCategory?: LeadMemoryCategory;
    onSubmit: (content: string, category: LeadMemoryCategory) => Promise<boolean>;
    onCancel: () => void;
}) {
    const t = useTranslations("leadMemories");
    const [content, setContent] = useState(initialContent);
    const [category, setCategory] = useState<LeadMemoryCategory>(initialCategory);
    const [saving, setSaving] = useState(false);

    const trimmed = content.trim();
    const valid = trimmed.length > 0 && trimmed.length <= LEAD_MEMORY_MAX_CONTENT_LENGTH;

    const handleSubmit = async () => {
        if (!valid || saving) return;
        setSaving(true);
        const ok = await onSubmit(trimmed, category);
        setSaving(false);
        if (ok) {
            setContent("");
        }
    };

    return (
        <div className="flex flex-col gap-2 rounded-[--radius] border border-border bg-card p-2">
            <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={t("addPlaceholder")}
                rows={3}
                maxLength={LEAD_MEMORY_MAX_CONTENT_LENGTH}
                autoFocus
                className="w-full resize-none rounded-[--radius] border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-2">
                <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as LeadMemoryCategory)}
                    aria-label={t("categoryLabel")}
                    className="min-w-0 flex-1 rounded-[--radius] border border-border bg-background px-2 py-1 text-2xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    {LEAD_MEMORY_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                            {t(`categories.${value}`)}
                        </option>
                    ))}
                </select>
                <span className="flex-shrink-0 text-2xs tabular-nums text-muted-foreground">
                    {trimmed.length}/{LEAD_MEMORY_MAX_CONTENT_LENGTH}
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-shrink-0 rounded-[--radius] px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                    {t("cancelButton")}
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!valid || saving}
                    className="flex-shrink-0 rounded-[--radius] bg-primary px-2.5 py-1 text-2xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
                >
                    {t("saveButton")}
                </button>
            </div>
        </div>
    );
}

function memoryErrorCopy(
    error: LeadMemoryError,
    t: ReturnType<typeof useTranslations<"leadMemories">>,
): string {
    switch (error.code) {
        case "memory_duplicate":
            return t("errors.duplicate");
        case "memory_limit":
            return t("errors.limit");
        default:
            return t("errors.generic");
    }
}
