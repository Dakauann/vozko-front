"use client";

import { useState } from "react";
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
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { adminUnlockSendCapAction } from "@/app/actions/send-caps";
import {
    SEND_CAP_CODE_LENGTH,
    isCompleteSendCapCode,
    parseSendCapCycleDay,
    parseSendCapLimit,
    type SendCapItem,
    type SendCapUnlockTarget,
} from "@/lib/balance/send-cap-types";

import { describeSendCapError } from "./send-cap-errors";
import { SendCapDialogError, SendCapField } from "./send-cap-field";

export function SendCapUnlockDialog({
    item,
    onClose,
    onUnlocked,
}: {
    item: SendCapItem;
    onClose: () => void;
    onUnlocked: () => void;
}) {
    const t = useTranslations("adminSendCaps");

    const [removeCap, setRemoveCap] = useState(false);
    const [limitText, setLimitText] = useState("");
    const [cycleDayText, setCycleDayText] = useState(String(item.cycleDay));
    const [code, setCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const limit = parseSendCapLimit(limitText);
    const cycleDay = parseSendCapCycleDay(cycleDayText);
    const target: SendCapUnlockTarget | null = removeCap
        ? { kind: "remove" }
        : limit !== null && cycleDay !== null
          ? { kind: "raise", limit, cycleDay }
          : null;
    const ready = target !== null && isCompleteSendCapCode(code);

    const handleUnlock = async () => {
        if (!target || !ready) return;
        setSaving(true);
        setError(null);
        const result = await adminUnlockSendCapAction(item.workspaceId, target, code);
        setSaving(false);
        if (result.error) {
            setCode("");
            setError(describeSendCapError(t, result.error));
            return;
        }
        onUnlocked();
    };

    return (
        <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
            <ElevatedDialogContent className="flex w-full max-w-md flex-col gap-0 overflow-hidden !p-0">
                <ElevatedDialogHeader className="border-b border-border px-5 py-4">
                    <ElevatedDialogTitle>{t("unlockDialog.title", { workspace: item.workspaceName })}</ElevatedDialogTitle>
                </ElevatedDialogHeader>

                <div className="space-y-5 p-5">
                    <p className="text-sm text-muted-foreground">
                        {t("unlockDialog.current", { used: item.used, limit: item.limit })}
                    </p>

                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-0.5">
                            <span className="text-sm font-medium text-foreground">{t("unlockDialog.removeCap")}</span>
                            <p className="text-xs text-muted-foreground">{t("unlockDialog.removeCapHint")}</p>
                        </div>
                        <ElevatedSwitch
                            checked={removeCap}
                            onCheckedChange={setRemoveCap}
                            aria-label={t("unlockDialog.removeCap")}
                        />
                    </div>

                    {!removeCap && (
                        <>
                            <SendCapField label={t("unlockDialog.newLimit")}>
                                <ElevatedInput
                                    autoFocus
                                    inputMode="numeric"
                                    value={limitText}
                                    onChange={(e) => setLimitText(e.target.value)}
                                    placeholder={String(item.limit * 2)}
                                />
                            </SendCapField>
                            <SendCapField label={t("unlockDialog.cycleDay")} hint={t("unlockDialog.cycleDayHint")}>
                                <ElevatedInput
                                    inputMode="numeric"
                                    aria-label={t("unlockDialog.cycleDay")}
                                    value={cycleDayText}
                                    onChange={(e) => setCycleDayText(e.target.value)}
                                />
                            </SendCapField>
                        </>
                    )}

                    <SendCapField label={t("unlockDialog.code")} hint={t("unlockDialog.codeHint")}>
                        <ElevatedInput
                            type="password"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={SEND_CAP_CODE_LENGTH}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, SEND_CAP_CODE_LENGTH))}
                            aria-label={t("unlockDialog.code")}
                            className="font-mono tracking-[0.5em]"
                        />
                    </SendCapField>

                    <SendCapDialogError message={error} />
                </div>

                <ElevatedDialogFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
                    <Button title={t("actions.cancel")} variant="ghost" disabled={saving} onClick={onClose} />
                    <Button
                        title={saving ? t("actions.saving") : removeCap ? t("unlockDialog.confirmRemove") : t("unlockDialog.confirmRaise")}
                        variant="primary"
                        disabled={saving || !ready}
                        onClick={() => void handleUnlock()}
                    />
                </ElevatedDialogFooter>
            </ElevatedDialogContent>
        </ElevatedDialog>
    );
}
