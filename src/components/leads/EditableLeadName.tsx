"use client";

import * as React from "react";
import { Check, PencilSimple, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { renameLeadAction } from "@/app/actions/leads";
import { cn } from "@/lib/utils";

/** Mirrors the server's MaxLeadNameLength so the field stops before a 400. */
const MAX_NAME_LENGTH = 120;

type EditableLeadNameProps = {
    leadId: string;
    /** Current name; null/empty means the lead is shown by its number. */
    name?: string | null;
    /** Shown when there is no name — normally the phone number. */
    fallback: string;
    /** RBAC: leads:update. Without it the name renders as plain text. */
    canEdit: boolean;
    onRenamed?: (name: string) => void;
    className?: string;
    /** The CRM header needs a larger register than a table cell. */
    size?: "sm" | "md";
};

/**
 * A lead name you can edit in place.
 *
 * Modelled on how WhatsApp treats a contact name, because that is the mental
 * model operators already have: the name is just there, editing is one tap, the
 * keyboard commits, and clearing it falls back to the number rather than
 * leaving a blank where a person's name should be.
 *
 * Deliberately NOT a dialog. A rename is a one-field, instantly-reversible
 * change made while reading a conversation; a modal would take the conversation
 * off screen to edit a label attached to it.
 */
export function EditableLeadName({
    leadId,
    name,
    fallback,
    canEdit,
    onRenamed,
    className,
    size = "sm",
}: EditableLeadNameProps) {
    const t = useTranslations("leads.rename");
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(name ?? "");
    const [saving, setSaving] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Re-seed when the lead changes underneath us (switching conversations
    // reuses this component), but never while the operator is mid-edit — that
    // would overwrite what they are typing with a websocket update.
    React.useEffect(() => {
        if (!editing) setDraft(name ?? "");
    }, [name, editing, leadId]);

    React.useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    const display = name?.trim() ? name : fallback;

    const commit = async () => {
        const next = draft.trim();
        if (next === (name ?? "").trim()) {
            setEditing(false);
            return;
        }
        setSaving(true);
        const result = await renameLeadAction(leadId, next);
        setSaving(false);

        if (result.error) {
            toast.error(result.error);
            return; // stay in edit mode so the typing is not lost
        }
        // Echo the STORED name: the server trims and collapses whitespace, and
        // the field should show what the next page load will show.
        const stored = result.lead?.name ?? "";
        setDraft(stored);
        onRenamed?.(stored);
        setEditing(false);
        toast.success(next ? t("saved") : t("cleared"));
    };

    const cancel = () => {
        setDraft(name ?? "");
        setEditing(false);
    };

    if (!canEdit) {
        return <span className={className}>{display}</span>;
    }

    if (!editing) {
        return (
            <button
                type="button"
                onClick={() => setEditing(true)}
                title={t("edit")}
                className={cn(
                    "group inline-flex min-w-0 items-center gap-1.5 rounded-[--radius] text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    className,
                )}
            >
                <span className={cn("truncate", !name?.trim() && "text-muted-foreground")}>
                    {display}
                </span>
                {/* The affordance stays out of the way until hover/focus: a
                    pencil beside every name in a list is visual noise on a
                    screen whose job is reading conversations, not editing them. */}
                <PencilSimple
                    className={cn(
                        "shrink-0 text-muted-foreground opacity-0 transition-opacity",
                        "group-hover:opacity-100 group-focus-visible:opacity-100",
                        size === "md" ? "h-4 w-4" : "h-3.5 w-3.5",
                    )}
                />
            </button>
        );
    }

    return (
        <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
            <input
                ref={inputRef}
                value={draft}
                disabled={saving}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    // Enter commits, Escape abandons — the two keys anyone
                    // already expects from an inline field.
                    if (e.key === "Enter") {
                        e.preventDefault();
                        void commit();
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                    }
                }}
                // Blur COMMITS rather than cancelling. Clicking away from a
                // field you have just typed into reads as "done", and losing
                // the edit there is the single most annoying thing an inline
                // editor can do.
                onBlur={() => void commit()}
                placeholder={fallback}
                aria-label={t("label")}
                className={cn(
                    "min-w-0 flex-1 rounded-[--radius] border border-control-edge bg-card px-2 py-1",
                    "text-foreground outline-none focus:border-primary disabled:opacity-60",
                    size === "md" ? "text-sm" : "text-xs",
                )}
            />
            {/* Mousedown, not click: blur fires first on click and would commit
                before cancel ever ran, making the X behave like a save. */}
            <button
                type="button"
                onMouseDown={(e) => {
                    e.preventDefault();
                    cancel();
                }}
                disabled={saving}
                aria-label={t("cancel")}
                className="shrink-0 rounded-[--radius] p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <X className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void commit()}
                disabled={saving}
                aria-label={t("save")}
                className="shrink-0 rounded-[--radius] p-1 text-primary-ink transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Check className="h-3.5 w-3.5" weight="bold" />
            </button>
        </span>
    );
}
