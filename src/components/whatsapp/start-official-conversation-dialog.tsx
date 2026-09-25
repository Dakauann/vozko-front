"use client";

import {
    ArrowLeft,
    ArrowSquareOut,
    CaretRight,
    CheckCircle,
    CircleNotch,
    Clock,
    PaperPlaneTilt,
    Plus,
    SquaresFour,
    Warning,
    WarningCircle,
} from "@/components/icons";
import {
    ElevatedDialog,
    ElevatedDialogContent,
    ElevatedDialogDescription,
    ElevatedDialogFooter,
    ElevatedDialogHeader,
    ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
    UTILITY_STARTERS,
    isValidTemplateName,
    normalizeTemplateName,
    starterComponents,
    type TemplateStarter,
} from "@/lib/whatsapp-outreach/types";
import { hasMediaHeader } from "@/lib/whatsapp-templates/params";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { TemplateConversationPreview } from "@/components/whatsapp/template-conversation-preview";
import { TemplateVariableFields } from "@/components/whatsapp/template-variable-fields";
import { useTemplateComposer } from "@/hooks/use-template-composer";
import type { TemplateMessageMetadata } from "@/lib/conversations/types";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import { cn } from "@/lib/utils";
import { createWhatsAppTemplateAction, getWhatsAppTemplateByIdAction } from "@/app/actions/whatsapp-templates";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { normalizeRecipients } from "@/lib/unofficial-whatsapp/recipients";
import { startOfficialConversationAction } from "@/app/actions/whatsapp-outreach";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export function StartOfficialConversationDialog({
    open,
    onOpenChange,
    onStarted,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStarted: (entryId: string, entryType: string) => void;
}) {
    const t = useTranslations("whatsappOutreach");
    const tTemplates = useTranslations("whatsappTemplates");
    const { can } = useWorkspace();
    const canCreateTemplate = can("whatsapp_templates", "create");

    const [mode, setMode] = useState<"send" | "create">("send");


    const [phones, setPhones] = useState<WhatsAppBusinessPhone[]>([]);
    const [phoneId, setPhoneId] = useState("");
    const [recipient, setRecipient] = useState("");
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<{ code: string; message: string } | null>(null);

    const idempotencyKey = useRef<string>("");

    const composer = useTemplateComposer({ businessPhoneId: phoneId, enabled: open });
    const {
        templateId,
        template,
        slots,
        bodyValues,
        headerValues,
        templatesLoading,
        readyTemplates,
        pendingCount,
        missingValues,
        previewMetadata,
        templateOptions,
        quote,
        priceLabel,
        reset: resetComposer,
        reload: reloadTemplates,
        upsertTemplate,
    } = composer;

    const parsed = useMemo(() => normalizeRecipients(recipient), [recipient]);
    const resolvedNumber = parsed.valid[0] ?? "";

    const canSubmit =
        Boolean(phoneId) && Boolean(templateId) && Boolean(resolvedNumber) && !missingValues && !busy;

    useEffect(() => {
        if (open) {
            idempotencyKey.current =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random()}`;
            return;
        }
        setMode("send");
        setRecipient("");
        setName("");
        resetComposer();
        setError(null);
    }, [open, resetComposer]);

    useEffect(() => {
        if (!open) return;
        void (async () => {
            const result = await listBusinessPhonesAction({ status: "CONNECTED", page: 1, pageSize: 50 });
            const connected = result.phones ?? [];
            setPhones(connected);
            if (connected.length === 1) setPhoneId(connected[0].id);
        })();
    }, [open]);

    const submit = useCallback(async () => {
        setBusy(true);
        setError(null);

        const { conversation, error: sendError } = await startOfficialConversationAction(
            {
                businessPhoneId: phoneId,
                templateId,
                phoneNumber: resolvedNumber,
                name: name.trim() || undefined,
                parameters: slots.body.length > 0 ? bodyValues : undefined,
                headerParameters: slots.header.length > 0 ? headerValues : undefined,
            },
            idempotencyKey.current,
        );
        setBusy(false);

        if (sendError) {
            if (sendError.code === "window_already_open" && sendError.entryId) {
                onStarted(sendError.entryId, sendError.entryType ?? "whatsapp");
                onOpenChange(false);
                return;
            }
            setError({ code: sendError.code, message: sendError.message });
            return;
        }
        if (!conversation) {
            setError({ code: "send_failed", message: t("errors.send_failed") });
            return;
        }

        onStarted(conversation.entryId, conversation.entryType);
        onOpenChange(false);
    }, [
        phoneId, templateId, resolvedNumber, name, bodyValues, headerValues,
        slots.body.length, slots.header.length, onStarted, onOpenChange, t,
    ]);



    const [starter, setStarter] = useState<TemplateStarter | null>(null);
    const [newName, setNewName] = useState("");
    const [newBody, setNewBody] = useState("");
    const [newExamples, setNewExamples] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [submittedForReview, setSubmittedForReview] = useState<string | null>(null);

    const newBodySlots = useMemo(() => {
        const matches = [...newBody.matchAll(/\{\{([^}]+)\}\}/g)];
        return matches.map((m) => m[1].trim());
    }, [newBody]);

    const draftPreview: TemplateMessageMetadata | null = useMemo(() => {
        if (!newBody.trim()) return null;
        const rendered = newBodySlots.reduce(
            (text, slot, index) =>
                text
                    .replaceAll(`{{${index + 1}}}`, newExamples[index]?.trim() || `{{${slot}}}`)
                    .replaceAll(`{{${slot}}}`, newExamples[index]?.trim() || `{{${slot}}}`),
            newBody,
        );
        return {
            template_name: newName || "—",
            language: "pt_BR",
            category: "UTILITY",
            components: [{ type: "BODY", text: rendered }] as TemplateMessageMetadata["components"],
        };
    }, [newBody, newBodySlots, newExamples, newName]);

    const applyStarter = useCallback(
        (choice: TemplateStarter) => {
            setStarter(choice);
            setNewName(choice.suggestedName);
            setNewBody(t(choice.bodyKey));
            setNewExamples(new Array(choice.variableCount).fill(""));
            setCreateError(null);
        },
        [t],
    );

    const canCreate =
        Boolean(phoneId) &&
        isValidTemplateName(newName) &&
        newBody.trim().length > 0 &&
        newBodySlots.every((_, i) => newExamples[i]?.trim()) &&
        !creating;

    const createTemplate = useCallback(async () => {
        setCreating(true);
        setCreateError(null);

        const result = await createWhatsAppTemplateAction({
            businessPhoneId: phoneId,
            name: newName,
            language: "pt_BR",
            category: "UTILITY",
            components: starterComponents(newBody, newExamples.filter((value) => value.trim())),
        });
        setCreating(false);

        if (result.error || !result.template) {
            setCreateError(result.error ?? t("create.failed"));
            return;
        }
        if (result.template.status === "REJECTED") {
            setCreateError(t("create.rejected"));
            return;
        }
        setSubmittedForReview(result.template.name);
        reloadTemplates();
        const refreshed = await getWhatsAppTemplateByIdAction(result.template.id);
        if (refreshed.template) {
            upsertTemplate(refreshed.template as WhatsAppTemplate);
        }
    }, [phoneId, newName, newBody, newExamples, t, reloadTemplates, upsertTemplate]);

    const backToSend = useCallback(() => {
        setMode("send");
        setSubmittedForReview(null);
        setCreateError(null);
    }, []);



    return (
        <ElevatedDialog open={open} onOpenChange={onOpenChange}>
            <ElevatedDialogContent
                className="max-h-[min(88vh,820px)] overflow-hidden sm:max-w-[880px]"
            >
                {mode === "send" ? (
                    <>
                        <ElevatedDialogHeader>
                            <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
                            <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
                        </ElevatedDialogHeader>

                        {
}
                        <div className="-mx-7 min-h-0 flex-1 overflow-y-auto px-7">
                            {phones.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                                    {t("noNumbers")}
                                </p>
                            ) : (
                                <div className="grid gap-x-7 gap-y-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                                  <div className="space-y-6">
                                    <PhonePicker
                                        phones={phones}
                                        value={phoneId}
                                        onChange={setPhoneId}
                                        legend={t("fromLabel")}
                                    />

                                    {
}
                                    <div className="space-y-1.5">
                                        <ElevatedCommandSelect
                                            label={t("templateLabel")}
                                            value={templateId}
                                            onValueChange={composer.selectTemplate}
                                            options={templateOptions}
                                            disabled={!phoneId || templatesLoading}
                                            isLoading={templatesLoading}
                                            searchPlaceholder={t("templateSearch")}
                                            emptyMessage={t("templateEmpty")}
                                            contentClassName="z-[200]"
                                            fullWidth
                                        />

                                        {!phoneId && phones.length > 1 && (
                                            <p className="text-xs text-muted-foreground">
                                                {t("pickPhoneFirst")}
                                            </p>
                                        )}

                                        {phoneId && !templatesLoading && readyTemplates.length === 0 && (
                                            <div className="rounded-lg border border-dashed border-border p-4">
                                                <p className="text-sm font-medium text-foreground">
                                                    {t("empty.title")}
                                                </p>
                                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                    {pendingCount > 0
                                                        ? t("empty.pending", { count: pendingCount })
                                                        : t("empty.none")}
                                                </p>
                                                {canCreateTemplate && (
                                                    <Button
                                                        variant="outline-subtle"
                                                        size="sm"
                                                        className="mt-3"
                                                        title={t("create.open")}
                                                        icon={<Plus className="h-4 w-4" weight="bold" />}
                                                        iconVisible
                                                        iconSide="left"
                                                        onClick={() => setMode("create")}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {canCreateTemplate && readyTemplates.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setMode("create")}
                                                className="group flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            >
                                                <Plus className="h-3.5 w-3.5" weight="bold" aria-hidden />
                                                {t("create.open")}
                                                <CaretRight className="h-3 w-3 transition group-hover:translate-x-0.5" aria-hidden />
                                            </button>
                                        )}

                                        {template && hasMediaHeader(template) && !template.headerMediaId && (
                                            <p className="flex items-start gap-1.5 text-xs text-warning-ink">
                                                <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
                                                {t("mediaHeaderMissing")}
                                            </p>
                                        )}
                                    </div>

                                    {
}
                                    <div className="space-y-3">
                                      <div className="space-y-1.5">
                                        <ElevatedInput
                                            label={t("phoneLabel")}
                                            value={recipient}
                                            onChange={(event) => setRecipient(event.target.value)}
                                            placeholder="5511999999999"
                                            inputMode="tel"
                                            className="w-full"
                                            inputClassName="font-mono"
                                        />
                                        {resolvedNumber ? (
                                            <p className="flex items-center gap-1.5 text-xs text-healthy-ink">
                                                <CheckCircle className="h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
                                                <span className="readout font-medium">+{resolvedNumber}</span>
                                                <span className="text-muted-foreground">{t("resolved")}</span>
                                            </p>
                                        ) : (
                                            <p
                                                className={cn(
                                                    "text-xs",
                                                    parsed.invalid > 0 && recipient.trim().length > 5
                                                        ? "text-warning-ink"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                {parsed.invalid > 0 && recipient.trim().length > 5
                                                    ? t("phoneInvalid")
                                                    : t("phoneHint")}
                                            </p>
                                        )}
                                    </div>

                                      <ElevatedInput
                                          label={t("nameLabel")}
                                          value={name}
                                          onChange={(event) => setName(event.target.value)}
                                          placeholder={t("namePlaceholder")}
                                          className="w-full"
                                      />
                                    </div>

                                    {
}
                                    <TemplateVariableFields
                                        slots={slots}
                                        bodyValues={bodyValues}
                                        headerValues={headerValues}
                                        onBodyChange={composer.setBodyValue}
                                        onHeaderChange={composer.setHeaderValue}
                                    />

                                  </div>

                                  {
}
                                  <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                                    <span className="legend">{t("previewLabel")}</span>
                                    <TemplateConversationPreview
                                        metadata={previewMetadata}
                                        dateLabel={t("today")}
                                        emptyLabel={t("previewEmpty")}
                                        className="min-h-[220px] lg:min-h-[300px]"
                                    />

                                    <div className="rounded-lg border border-border bg-muted p-3">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-xs text-muted-foreground">{t("cost.label")}</span>
                                            <span className="readout text-sm font-semibold text-foreground">
                                                {priceLabel ?? "—"}
                                            </span>
                                        </div>
                                        {quote && !quote.affordable && (
                                            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive-ink">
                                                <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" aria-hidden />
                                                {t("cost.insufficient")}
                                            </p>
                                        )}
                                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                            {t("risk")}
                                        </p>
                                    </div>

                                    {error && (
                                        <p className="rounded-[--radius] bg-muted px-3 py-2 text-sm text-destructive-ink">
                                            {t.has(`errors.${error.code}`) ? t(`errors.${error.code}`) : error.message}
                                        </p>
                                    )}
                                  </div>
                                </div>
                            )}
                        </div>

                        <ElevatedDialogFooter className="-mx-7 shrink-0 border-t border-border px-7 pt-4">
                            <Button
                                variant="secondary"
                                title={t("cancel")}
                                onClick={() => onOpenChange(false)}
                                disabled={busy}
                            />
                            {phones.length > 0 && (
                                <Button
                                    variant="primary"
                                    title={busy ? t("sending") : priceLabel ? t("submitWithPrice", { price: priceLabel }) : t("submit")}
                                    icon={
                                        busy ? (
                                            <CircleNotch className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                                        )
                                    }
                                    iconVisible
                                    iconSide="left"
                                    onClick={() => void submit()}
                                    disabled={!canSubmit}
                                />
                            )}
                        </ElevatedDialogFooter>
                    </>
                ) : (
                    <>
                        <ElevatedDialogHeader>
                            <ElevatedDialogTitle>{t("create.title")}</ElevatedDialogTitle>
                            <ElevatedDialogDescription>{t("create.description")}</ElevatedDialogDescription>
                        </ElevatedDialogHeader>

                        <div className="-mx-7 min-h-0 flex-1 overflow-y-auto px-7">
                        {submittedForReview ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
                                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-info-ink" weight="fill" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground">
                                            {t("create.submitted.title", { name: submittedForReview })}
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            {t("create.submitted.description")}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-x-7 gap-y-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                              <div className="space-y-6">
                                <PhonePicker
                                    phones={phones}
                                    value={phoneId}
                                    onChange={setPhoneId}
                                    legend={t("create.phoneLabel")}
                                />
                                {phones.length > 1 && (
                                    <p className="-mt-3 text-xs leading-relaxed text-muted-foreground">
                                        {t("create.phoneHint")}
                                    </p>
                                )}

                                {
}
                                <div className="space-y-2">
                                    <span className="legend">{t("create.startersLabel")}</span>
                                    <div className="grid gap-2">
                                        {UTILITY_STARTERS.map((choice) => (
                                            <button
                                                key={choice.id}
                                                type="button"
                                                aria-pressed={starter?.id === choice.id}
                                                onClick={() => applyStarter(choice)}
                                                className={cn(
                                                    "relative overflow-hidden rounded-lg border p-3 text-left transition",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                    starter?.id === choice.id
                                                        ? "border-control-edge bg-muted"
                                                        : "border-border bg-card hover:bg-muted",
                                                )}
                                            >
                                                {starter?.id === choice.id && (
                                                    <span
                                                        aria-hidden
                                                        className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-primary"
                                                    />
                                                )}
                                                <p className="text-sm font-medium text-foreground">
                                                    {t(`create.starters.${choice.id}.title`)}
                                                </p>
                                                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                                    {t(`create.starters.${choice.id}.body`)}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        {t("create.utilityNote")}
                                    </p>

                                    {
}
                                    <a
                                        href="/dashboard/whatsapp-templates/new"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-start gap-2 rounded-[--radius] border border-border bg-card p-3 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <SquaresFour
                                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                            weight="bold"
                                            aria-hidden
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-xs font-medium text-foreground">
                                                {t("create.fullBuilder.title")}
                                            </span>
                                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                                {t("create.fullBuilder.description")}
                                            </span>
                                        </span>
                                        <ArrowSquareOut
                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground"
                                            aria-hidden
                                        />
                                    </a>
                                </div>

                                <ElevatedInput
                                    label={t("create.nameLabel")}
                                    value={newName}
                                    onChange={(event) => setNewName(normalizeTemplateName(event.target.value))}
                                    placeholder="retomada_atendimento"
                                    className="w-full"
                                    inputClassName="font-mono"
                                    error={newName && !isValidTemplateName(newName) ? t("create.nameInvalid") : undefined}
                                />

                                <ElevatedTextarea
                                    label={t("create.bodyLabel")}
                                    value={newBody}
                                    onChange={(event) => setNewBody(event.target.value)}
                                    rows={4}
                                    className="w-full"
                                />

                                {newBodySlots.length > 0 && (
                                    <div className="space-y-3">
                                        <span className="legend">{t("create.examplesLabel")}</span>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {t("create.examplesHint")}
                                        </p>
                                        {newBodySlots.map((slot, index) => (
                                            <ElevatedInput
                                                key={`example-${index}`}
                                                label={t("create.exampleFor", { name: slot })}
                                                value={newExamples[index] ?? ""}
                                                onChange={(event) => {
                                                    const next = [...newExamples];
                                                    next[index] = event.target.value;
                                                    setNewExamples(next);
                                                }}
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                )}

                                {createError && (
                                    <p className="rounded-[--radius] bg-muted px-3 py-2 text-sm text-destructive-ink">
                                        {createError}
                                    </p>
                                )}
                              </div>

                              {
}
                              <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                                <span className="legend">{t("create.previewLabel")}</span>
                                <TemplateConversationPreview
                                    metadata={draftPreview}
                                    dateLabel={t("today")}
                                    emptyLabel={t("create.previewEmpty")}
                                    className="min-h-[260px] lg:min-h-[420px]"
                                />
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    {t("create.previewHint")}
                                </p>

                                {
}
                                <div className="rounded-lg border border-border bg-muted p-3">
                                    <div className="flex items-start gap-2.5">
                                        <Clock
                                            className="mt-0.5 h-4 w-4 shrink-0 text-info-ink"
                                            weight="fill"
                                            aria-hidden
                                        />
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-foreground">
                                                {tTemplates("new.approvalRequired.title")}
                                            </p>
                                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                                {tTemplates("new.approvalRequired.description")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                              </div>
                            </div>
                        )}
                        </div>

                        <ElevatedDialogFooter className="-mx-7 shrink-0 border-t border-border px-7 pt-4">
                            <Button
                                variant="secondary"
                                title={submittedForReview ? t("create.backToSend") : t("create.back")}
                                icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
                                iconVisible
                                iconSide="left"
                                onClick={backToSend}
                                disabled={creating}
                            />
                            {!submittedForReview && (
                                <Button
                                    variant="primary"
                                    title={creating ? t("create.submitting") : t("create.submit")}
                                    icon={
                                        creating ? (
                                            <CircleNotch className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" weight="bold" />
                                        )
                                    }
                                    iconVisible
                                    iconSide="left"
                                    onClick={() => void createTemplate()}
                                    disabled={!canCreate}
                                />
                            )}
                        </ElevatedDialogFooter>
                    </>
                )}
            </ElevatedDialogContent>
        </ElevatedDialog>
    );
}

function PhonePicker({
    phones,
    value,
    onChange,
    legend,
}: {
    phones: WhatsAppBusinessPhone[];
    value: string;
    onChange: (id: string) => void;
    legend: string;
}) {
    if (phones.length <= 1) return null;

    return (
        <div className="space-y-2">
            <span className="legend">{legend}</span>
            <div className="grid gap-2 sm:grid-cols-2">
                {phones.map((phone) => (
                    <button
                        key={phone.id}
                        type="button"
                        aria-pressed={value === phone.id}
                        onClick={() => onChange(phone.id)}
                        className={cn(
                            "relative overflow-hidden rounded-lg border p-3 text-left transition",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            value === phone.id
                                ? "border-control-edge bg-muted"
                                : "border-border bg-card hover:bg-muted",
                        )}
                    >
                        {value === phone.id && (
                            <span
                                aria-hidden
                                className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-primary"
                            />
                        )}
                        <p className="readout truncate text-sm text-foreground">
                            {phone.displayPhoneNumber}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {phone.verifiedName || phone.wabaName || ""}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
