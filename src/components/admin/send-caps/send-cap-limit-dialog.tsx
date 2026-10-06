"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
    ElevatedDialog,
    ElevatedDialogContent,
    ElevatedDialogFooter,
    ElevatedDialogHeader,
    ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { adminSetSendCapAction } from "@/app/actions/send-caps";
import { adminListAllWorkspacesAction } from "@/app/actions/workspace";
import {
    SEND_CAP_DEFAULT_CYCLE_DAY,
    parseSendCapCycleDay,
    parseSendCapLimit,
    type SendCapItem,
} from "@/lib/balance/send-cap-types";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

import { describeSendCapError } from "./send-cap-errors";
import { SendCapDialogError, SendCapField } from "./send-cap-field";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 8;

type PickedWorkspace = Pick<Workspace, "id" | "name">;

export function SendCapLimitDialog({
    item,
    canUnlock,
    onClose,
    onSaved,
    onUnlockInstead,
}: {
    item: SendCapItem | null;
    canUnlock: boolean;
    onClose: () => void;
    onSaved: () => void;
    onUnlockInstead: (item: SendCapItem) => void;
}) {
    const t = useTranslations("adminSendCaps");
    const editing = item !== null;

    const [workspace, setWorkspace] = useState<PickedWorkspace | null>(
        item ? { id: item.workspaceId, name: item.workspaceName } : null,
    );
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<PickedWorkspace[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [limitText, setLimitText] = useState(item ? String(item.limit) : "");
    const [cycleDayText, setCycleDayText] = useState(String(SEND_CAP_DEFAULT_CYCLE_DAY));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const limit = parseSendCapLimit(limitText);
    const cycleDay = editing ? item.cycleDay : parseSendCapCycleDay(cycleDayText);
    const raising = editing && limit !== null && limit > item.limit;

    useEffect(() => {
        const query = search.trim();
        if (editing || query.length === 0) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void adminListAllWorkspacesAction({ search: query, pageSize: SEARCH_PAGE_SIZE }).then((result) => {
                if (cancelled) return;
                setSearchError(result.error ?? null);
                setResults(result.workspaces.map(({ id, name }) => ({ id, name })));
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [editing, search]);

    const handleSave = async () => {
        if (!workspace || limit === null || cycleDay === null) return;
        setSaving(true);
        setError(null);
        const result = editing
            ? await adminSetSendCapAction(workspace.id, limit)
            : await adminSetSendCapAction(workspace.id, limit, cycleDay);
        setSaving(false);
        if (result.error) {
            setError(describeSendCapError(t, result.error));
            return;
        }
        onSaved();
    };

    return (
        <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
            <ElevatedDialogContent className="flex w-full max-w-md flex-col gap-0 overflow-hidden !p-0">
                <ElevatedDialogHeader className="border-b border-border px-5 py-4">
                    <ElevatedDialogTitle>
                        {editing ? t("limitDialog.editTitle", { workspace: item.workspaceName }) : t("limitDialog.createTitle")}
                    </ElevatedDialogTitle>
                </ElevatedDialogHeader>

                <div className="space-y-5 p-5">
                    {!editing && (
                        <SendCapField label={t("limitDialog.workspace")}>
                            {workspace ? (
                                <div className="flex items-center justify-between gap-3 rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm">
                                    <span className="truncate font-medium text-foreground">{workspace.name}</span>
                                    <Button
                                        title={t("limitDialog.changeWorkspace")}
                                        variant="ghost"
                                        onClick={() => setWorkspace(null)}
                                    />
                                </div>
                            ) : (
                                <>
                                    <ElevatedInput
                                        autoFocus
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t("limitDialog.searchPlaceholder")}
                                    />
                                    {searchError ? <SendCapDialogError message={searchError} /> : null}
                                    {search.trim() && results.length > 0 ? (
                                        <ul className="max-h-56 overflow-y-auto rounded-[--radius] border border-border" role="listbox">
                                            {results.map((ws) => (
                                                <li key={ws.id}>
                                                    <button
                                                        type="button"
                                                        role="option"
                                                        aria-selected={false}
                                                        className="w-full truncate px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                                                        onClick={() => setWorkspace(ws)}
                                                    >
                                                        {ws.name}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </>
                            )}
                        </SendCapField>
                    )}

                    <SendCapField
                        label={t("limitDialog.limit")}
                        hint={editing ? t("limitDialog.editHint", { current: item.limit }) : t("limitDialog.createHint")}
                    >
                        <ElevatedInput
                            autoFocus={editing}
                            inputMode="numeric"
                            value={limitText}
                            onChange={(e) => setLimitText(e.target.value)}
                            placeholder="5000"
                            className={cn(limitText && limit === null && "ring-1 ring-destructive")}
                        />
                    </SendCapField>

                    {!editing && (
                        <SendCapField label={t("limitDialog.cycleDay")} hint={t("limitDialog.cycleDayHint")}>
                            <ElevatedInput
                                inputMode="numeric"
                                aria-label={t("limitDialog.cycleDay")}
                                value={cycleDayText}
                                onChange={(e) => setCycleDayText(e.target.value)}
                                className={cn(cycleDay === null && "ring-1 ring-destructive")}
                            />
                        </SendCapField>
                    )}

                    {raising ? (
                        <div className="space-y-2 rounded-lg bg-muted p-3 text-xs text-warning-ink">
                            <p>{canUnlock ? t("limitDialog.raiseNeedsUnlock") : t("limitDialog.raiseForbidden")}</p>
                            {canUnlock ? (
                                <Button
                                    title={t("actions.unlock")}
                                    variant="outline"
                                    onClick={() => onUnlockInstead(item)}
                                />
                            ) : null}
                        </div>
                    ) : null}

                    <SendCapDialogError message={error} />
                </div>

                <ElevatedDialogFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
                    <Button title={t("actions.cancel")} variant="ghost" disabled={saving} onClick={onClose} />
                    <Button
                        title={saving ? t("actions.saving") : t("actions.save")}
                        variant="primary"
                        disabled={saving || !workspace || limit === null || cycleDay === null || raising}
                        onClick={() => void handleSave()}
                    />
                </ElevatedDialogFooter>
            </ElevatedDialogContent>
        </ElevatedDialog>
    );
}
