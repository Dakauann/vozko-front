"use client";

import * as React from "react";
import { Check, PencilSimple, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { renameLeadAction } from "@/app/actions/leads";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 120;

type EditableLeadNameProps = {
    leadId: string;
    name?: string | null;
    fallback: string;
    canEdit: boolean;
    onRenamed?: (name: string) => void;
    className?: string;
    size?: "sm" | "md";
};

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
            return;
        }
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
                {
}
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
                    if (e.key === "Enter") {
                        e.preventDefault();
                        void commit();
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                    }
                }}
                onBlur={() => void commit()}
                placeholder={fallback}
                aria-label={t("label")}
                className={cn(
                    "min-w-0 flex-1 rounded-[--radius] border border-control-edge bg-card px-2 py-1",
                    "text-foreground outline-none focus:border-primary disabled:opacity-60",
                    size === "md" ? "text-sm" : "text-xs",
                )}
            />
            {
}
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
