"use client";

import * as React from "react";
import { Check, PencilSimple, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { renameLeadAction } from "@/app/actions/leads";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { isNewerVersion } from "@/lib/leads/version";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 120;

export interface LeadNameState {
    name: string;
    version: number;
}

type EditableLeadNameProps = {
    leadId: string;
    name?: string | null;
    version?: number;
    fallback: string;
    canEdit: boolean;
    onLeadChanged?: (lead: LeadNameState) => void;
    className?: string;
    size?: "sm" | "md";
};

interface LearnedLead extends LeadNameState {
    leadId: string;
}

interface EditBase {
    leadId: string;
    name: string;
    version?: number;
}

interface LeadConflict {
    leadId: string;
    name: string;
    nameChanged: boolean;
}

function newerState(
    leadId: string,
    shown: { name: string; version?: number },
    learned: LearnedLead | null,
): { name: string; version?: number } {
    if (!learned || learned.leadId !== leadId) return shown;
    return isNewerVersion(learned.version, shown.version) ? learned : shown;
}

function settledFor(leadId: string) {
    return (held: string | null) => (held === leadId ? null : held);
}

function endedFor(leadId: string) {
    return (held: EditBase | null) => (held?.leadId === leadId ? null : held);
}

function rebasedFor(leadId: string, base: EditBase) {
    return (held: EditBase | null) => (held?.leadId === leadId ? base : held);
}

export function EditableLeadName({
    leadId,
    name,
    version,
    fallback,
    canEdit,
    onLeadChanged,
    className,
    size = "sm",
}: EditableLeadNameProps) {
    const t = useTranslations("leads.rename");
    const tLeads = useTranslations("leads");
    const conflictId = React.useId();
    const [edit, setEdit] = React.useState<EditBase | null>(null);
    const [savingLead, setSavingLead] = React.useState<string | null>(null);
    const [learned, setLearned] = React.useState<LearnedLead | null>(null);
    const [conflict, setConflict] = React.useState<LeadConflict | null>(null);
    const [draft, setDraft] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    if (edit !== null && edit.leadId !== leadId) setEdit(null);
    if (conflict !== null && conflict.leadId !== leadId) setConflict(null);

    const editing = edit?.leadId === leadId;
    const saving = savingLead === leadId;
    const shownConflict = conflict?.leadId === leadId ? conflict : null;
    const current = newerState(leadId, { name: name ?? "", version }, learned);

    React.useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    const display = current.name.trim() ? current.name : fallback;

    const startEditing = () => {
        setDraft(current.name);
        setEdit({ leadId, name: current.name, version: current.version });
    };

    const commit = async () => {
        if (edit === null || edit.leadId !== leadId) return;
        const lead = leadId;
        const base = edit;
        const next = draft.trim();
        if (next === base.name.trim()) {
            setConflict(null);
            setEdit(null);
            return;
        }
        setSavingLead(lead);
        const result = await renameLeadAction(lead, next, base.version);
        setSavingLead(settledFor(lead));

        if (result.status === "conflict") {
            const theirs = result.current.name ?? "";
            setConflict({ leadId: lead, name: theirs, nameChanged: theirs.trim() !== base.name.trim() });
            setLearned({ leadId: lead, name: theirs, version: result.current.version });
            setEdit(rebasedFor(lead, { leadId: lead, name: theirs, version: result.current.version }));
            onLeadChanged?.({ name: theirs, version: result.current.version });
            return;
        }
        if (result.status === "failed") {
            toast.error(codedErrorMessage(tLeads, result.error, t("failed")));
            return;
        }
        const stored = result.lead.name ?? "";
        setConflict(null);
        setLearned({ leadId: lead, name: stored, version: result.lead.version });
        onLeadChanged?.({ name: stored, version: result.lead.version });
        setEdit(endedFor(lead));
        toast.success(next ? t("saved") : t("cleared"));
    };

    const cancel = () => {
        setConflict(null);
        setEdit(null);
    };

    const commitOnBlur = () => {
        if (shownConflict === null) void commit();
    };

    if (!canEdit) {
        return <span className={className}>{display}</span>;
    }

    if (!editing) {
        return (
            <button
                type="button"
                onClick={startEditing}
                title={t("edit")}
                className={cn(
                    "group inline-flex min-w-0 items-center gap-1.5 rounded-[--radius] text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    className,
                )}
            >
                <span className={cn("truncate", !current.name.trim() && "text-muted-foreground")}>
                    {display}
                </span>
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
        <span className={cn("inline-flex min-w-0 flex-col gap-1", className)}>
            <span className="inline-flex min-w-0 items-center gap-1">
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
                    onBlur={commitOnBlur}
                    placeholder={fallback}
                    aria-label={t("label")}
                    aria-invalid={shownConflict !== null}
                    aria-describedby={shownConflict !== null ? conflictId : undefined}
                    className={cn(
                        "min-w-0 flex-1 rounded-[--radius] border border-control-edge bg-card px-2 py-1",
                        "text-foreground outline-none focus:border-primary disabled:opacity-60",
                        size === "md" ? "text-sm" : "text-xs",
                    )}
                />
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancel}
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
            {shownConflict !== null ? (
                <span id={conflictId} role="alert" className="text-xs font-normal text-warning-ink">
                    {shownConflict.nameChanged
                        ? t("conflict", { name: shownConflict.name.trim() || fallback })
                        : t("conflictOther")}
                </span>
            ) : null}
        </span>
    );
}
