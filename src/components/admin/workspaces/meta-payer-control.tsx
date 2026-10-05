"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { adminUpdateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
    META_PAYERS,
    metaPayerSaveOutcome,
    parseMetaPayer,
} from "@/lib/workspace/workspace-config/meta-payer";
import type { MetaPayer, WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

export function MetaPayerControl({
    workspaceId,
    config,
    onSaved,
}: {
    workspaceId: string;
    config: WorkspaceConfig | null;
    onSaved: (config: WorkspaceConfig) => void;
}) {
    const t = useTranslations("adminWorkspaceDetail.config.metaPayer");
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const current = parseMetaPayer(config?.metaPayer);

    const save = async (next: MetaPayer) => {
        if (next === current || saving) return;
        setSaving(true);
        setError(null);
        const result = await adminUpdateWorkspaceConfigAction(workspaceId, { metaPayer: next });
        setSaving(false);
        const outcome = metaPayerSaveOutcome(next, result);
        if (!outcome.ok) {
            setError(outcome.error ?? t("notSaved"));
            return;
        }
        onSaved(outcome.config);
        toast({ title: t("success") });
    };

    return (
        <div
            className="mb-4 space-y-4 rounded-[--radius] border border-border bg-card p-5"
            style={{ boxShadow: softSurfaceShadow }}
        >
            <div>
                <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <ElevatedPillToggle<MetaPayer | "">
                    size="md"
                    value={current ?? ""}
                    onChange={(next) => {
                        if (next) void save(next);
                    }}
                    aria-label={t("title")}
                    options={META_PAYERS.map((payer) => ({
                        value: payer,
                        label: t(payer),
                        disabled: saving,
                    }))}
                />
                {saving ? (
                    <span className="text-xs text-muted-foreground" role="status">
                        {t("saving")}
                    </span>
                ) : null}
                {!saving && current === null ? (
                    <span className="text-xs text-muted-foreground">{t("notSet")}</span>
                ) : null}
            </div>
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
        </div>
    );
}
